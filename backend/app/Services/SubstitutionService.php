<?php

namespace App\Services;

use App\Models\Agenda;
use App\Models\AgendaFillSetting;
use App\Models\Schedule;
use App\Models\SubstitutionSession;
use App\Models\Teacher;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Aturan kelayakan guru inval, dipisah dari controller supaya bisa dipakai bersama oleh
 * daftar sesi (untuk ditampilkan) maupun validasi saat mengajukan (untuk ditegakkan).
 *
 * Kalau keduanya menghitung "boleh atau tidak" sendiri-sendiri, cepat atau lambat layar
 * menawarkan sesi yang server tolak — atau lebih buruk, menyembunyikan sesi yang sebenarnya
 * boleh.
 */
class SubstitutionService
{
    private const HARI_MAP = [
        'senin' => Carbon::MONDAY, 'selasa' => Carbon::TUESDAY, 'rabu' => Carbon::WEDNESDAY,
        'kamis' => Carbon::THURSDAY, 'jumat' => Carbon::FRIDAY,
        'sabtu' => Carbon::SATURDAY, 'minggu' => Carbon::SUNDAY,
    ];

    /**
     * Kenapa sesi ini TIDAK boleh diajukan. null = boleh.
     *
     * Urutannya sengaja: pemeriksaan termurah dan paling menentukan lebih dulu, supaya
     * pesan yang sampai ke guru adalah yang paling relevan (bukan "sudah ada pengajuan"
     * padahal masalah sebenarnya tanggalnya bukan hari mengajarnya).
     */
    public function alasanTidakBolehDiajukan(Schedule $schedule, string $tanggal): ?string
    {
        $tgl = Carbon::parse($tanggal, config('app.school_timezone'))->startOfDay();

        if ($tgl->dayOfWeek !== (self::HARI_MAP[$schedule->hari->value] ?? -1)) {
            return 'Tanggal ini bukan hari mengajar untuk jadwal tersebut.';
        }

        if (! $schedule->aktif) {
            return 'Jadwal ini sudah tidak aktif.';
        }

        // Inval mundur dibatasi aturan yang SAMA dengan batas isi agenda (Panel Admin →
        // Pengaturan Agenda). Tanpa batas ini, guru yang menunggak dua minggu bisa
        // mengalihkan hutangnya ke guru lain yang lengah menyetujui.
        $selesai = $this->sesiSelesaiPada($schedule, $tanggal);
        $batas   = AgendaFillSetting::instance()->batasWaktu($selesai);

        if (now()->greaterThan($batas)) {
            return 'Sesi ini sudah melewati batas waktu pengisian agenda ('
                .$batas->timezone(config('app.school_timezone'))->format('d/m/Y H:i')
                .'). Hubungi admin.';
        }

        if ($this->agendaSudahDiisi($schedule->id, $tanggal)) {
            return 'Agenda sesi ini sudah diisi, tidak perlu guru pengganti.';
        }

        if ($this->punyaPengajuanAktif($schedule->id, $tanggal)) {
            return 'Sesi ini sudah punya pengajuan inval yang aktif.';
        }

        return null;
    }

    /** Sesi milik guru ini dalam rentang tanggal, beserta status kelayakannya. */
    public function sesiMilikGuru(Teacher $teacher, Carbon $mulai, Carbon $akhir): Collection
    {
        $schedules = Schedule::where('teacher_id', $teacher->id)
            ->where('aktif', true)
            ->with(['subject', 'schoolClass'])
            ->get();

        $hasil = collect();

        foreach ($schedules as $schedule) {
            $target = self::HARI_MAP[$schedule->hari->value] ?? null;
            if ($target === null) {
                continue;
            }

            for ($d = $mulai->copy(); $d->lte($akhir); $d->addDay()) {
                if ($d->dayOfWeek !== $target) {
                    continue;
                }

                $tanggal = $d->toDateString();
                $alasan  = $this->alasanTidakBolehDiajukan($schedule, $tanggal);

                $hasil->push([
                    'schedule_id'  => $schedule->uuid,
                    'tanggal'      => $tanggal,
                    'hari'         => $schedule->hari->value,
                    'jam_mulai'    => substr($schedule->jam_mulai, 0, 5),
                    'jam_selesai'  => substr($schedule->jam_selesai, 0, 5),
                    'kelas'        => $this->labelKelas($schedule),
                    'mapel'        => $schedule->subject?->nama,
                    'bisa_diajukan'=> $alasan === null,
                    'alasan_blokir'=> $alasan,
                ]);
            }
        }

        return $hasil->sortBy([['tanggal', 'asc'], ['jam_mulai', 'asc']])->values();
    }

    /**
     * Guru lain sebagai calon pengganti, ditandai bentrok bila ia sudah terikat pada
     * salah satu sesi yang dipilih.
     *
     * Bentrok TIDAK memblokir — kadang guru memang ditugaskan tetap masuk dan kelasnya
     * digabung. Yang penting pengaju melihatnya sebelum mengirim, bukan setelah.
     *
     * @param  Collection<int,array{schedule:Schedule, tanggal:string}>  $sesiDipilih
     */
    public function calonPengganti(Teacher $pengaju, Collection $sesiDipilih): Collection
    {
        return Teacher::where('id', '!=', $pengaju->id)
            ->whereHas('user', fn ($q) => $q->where('status', 'aktif'))
            ->with('user:id,nama')
            ->get()
            ->map(function (Teacher $t) use ($sesiDipilih) {
                $bentrok = $sesiDipilih
                    ->filter(fn (array $s) => $this->bentrokPada($t, $s['schedule'], $s['tanggal']))
                    ->map(fn (array $s) => $this->labelBentrok($t, $s['schedule'], $s['tanggal']))
                    ->values();

                return [
                    'id'      => $t->uuid,
                    'nama'    => $t->user->nama,
                    'nip'     => $t->nip,
                    'bentrok' => $bentrok,
                ];
            })
            ->sortBy('nama')
            ->values();
    }

    /** Guru sudah terikat pada jam itu — lewat jadwalnya sendiri, atau inval yang ia terima. */
    public function bentrokPada(Teacher $teacher, Schedule $schedule, string $tanggal): bool
    {
        return $this->jadwalBentrok($teacher, $schedule, $tanggal) !== null
            || $this->invalBentrok($teacher, $schedule, $tanggal) !== null;
    }

    private function labelBentrok(Teacher $teacher, Schedule $schedule, string $tanggal): string
    {
        $lawan = $this->jadwalBentrok($teacher, $schedule, $tanggal)
            ?? $this->invalBentrok($teacher, $schedule, $tanggal);

        $tgl = Carbon::parse($tanggal)->format('d/m');

        return $tgl.' '.substr($lawan->jam_mulai, 0, 5).' — '.$this->labelKelas($lawan);
    }

    private function jadwalBentrok(Teacher $teacher, Schedule $schedule, string $tanggal): ?Schedule
    {
        return Schedule::where('teacher_id', $teacher->id)
            ->where('aktif', true)
            ->where('hari', $schedule->hari->value)
            ->where('id', '!=', $schedule->id)
            ->with('schoolClass')
            ->get()
            ->first(fn (Schedule $s) => $this->jamBeririsan($s, $schedule));
    }

    private function invalBentrok(Teacher $teacher, Schedule $schedule, string $tanggal): ?Schedule
    {
        return SubstitutionSession::query()
            ->where('tanggal', $tanggal)
            ->whereHas('request', fn ($q) => $q->disetujui()->where('substitute_teacher_id', $teacher->id))
            ->with('schedule.schoolClass')
            ->get()
            ->pluck('schedule')
            ->filter()
            ->first(fn (Schedule $s) => $s->id !== $schedule->id && $this->jamBeririsan($s, $schedule));
    }

    /** Dua sesi beririsan bila mulai salah satu jatuh sebelum selesai yang lain, dua arah. */
    private function jamBeririsan(Schedule $a, Schedule $b): bool
    {
        return $a->jam_mulai < $b->jam_selesai && $b->jam_mulai < $a->jam_selesai;
    }

    public function sesiSelesaiPada(Schedule $schedule, string $tanggal): Carbon
    {
        return Carbon::parse($tanggal.' '.$schedule->jam_selesai, config('app.school_timezone'));
    }

    public function agendaSudahDiisi(int $scheduleId, string $tanggal): bool
    {
        return Agenda::where('schedule_id', $scheduleId)->where('tanggal', $tanggal)->exists();
    }

    public function punyaPengajuanAktif(int $scheduleId, string $tanggal): bool
    {
        return SubstitutionSession::where('schedule_id', $scheduleId)
            ->where('tanggal', $tanggal)
            ->whereNotNull('slot_aktif')
            ->exists();
    }

    public function labelKelas(Schedule $schedule): string
    {
        $k = $schedule->schoolClass;

        return $k ? "{$k->tingkat->value} {$k->jurusan} - {$k->rombel}" : '—';
    }
}
