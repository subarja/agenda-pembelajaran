<?php

namespace App\Support;

use App\Models\AgendaFillSetting;
use App\Models\SubstitutionSession;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Satu-satunya sumber kebenaran untuk "siapa guru yang bertanggung jawab atas sesi ini".
 *
 * Sebelum fitur guru inval, jawabannya selalu `Schedule.teacher_id`, dan pertanyaan itu
 * diajukan di enam tempat berbeda: AgendaController::store(), AgendaController::perluDiisi(),
 * ScheduleController::today()/thisWeek(), PresensiController, dan TeacherEwsController.
 * Menambal keenamnya satu per satu adalah cara paling pasti untuk melahirkan sesi yang
 * hilang dari kedua guru, atau muncul di keduanya. Semuanya kini bertanya ke sini.
 *
 * Aturannya sesederhana mungkin: HANYA pengajuan berstatus `disetujui` yang memindahkan
 * tanggung jawab. Pengajuan yang masih menunggu jawaban tidak memindahkan apa pun — kalau
 * guru pengganti tidak pernah menjawab, sesi itu tetap kewajiban pengaju, dan tidak ada
 * satu sesi pun yang menggantung tanpa penanggung jawab.
 *
 * Sesi diidentifikasi dengan kunci gabungan "scheduleId|Y-m-d" supaya pemanggil yang
 * mengulang puluhan jadwal bisa menyaring di memori, bukan satu query per sesi.
 */
class SessionTeacher
{
    /** Teacher id yang bertanggung jawab atas (jadwal, tanggal). Fallback: guru terjadwal. */
    public static function effectiveTeacherId(int $scheduleId, string $tanggal, int $scheduleTeacherId): int
    {
        $sesi = static::approvedQuery()
            ->where('schedule_id', $scheduleId)
            ->where('tanggal', $tanggal)
            ->first();

        return $sesi?->request?->substitute_teacher_id ?? $scheduleTeacherId;
    }

    /** Apakah $teacherId berhak mengisi agenda sesi ini? (guru terjadwal ATAU pengganti resmi) */
    public static function isResponsible(int $teacherId, int $scheduleId, string $tanggal, int $scheduleTeacherId): bool
    {
        return static::effectiveTeacherId($scheduleId, $tanggal, $scheduleTeacherId) === $teacherId;
    }

    /**
     * Versi untuk agenda yang sudah ada — dipakai show/update/destroy agenda dan presensi.
     * Dipisah supaya pemanggil tidak perlu mengurai sendiri (schedule_id, tanggal) dari
     * relasi, dan tidak ada yang lupa memakai tanggal AGENDA (bukan tanggal hari ini).
     */
    public static function isResponsibleForAgenda(int $teacherId, \App\Models\Agenda $agenda): bool
    {
        return static::isResponsible(
            $teacherId,
            $agenda->schedule_id,
            $agenda->tanggal->toDateString(),
            $agenda->schedule->teacher_id,
        );
    }

    /**
     * Kunci sesi milik $teacherId yang sudah DIALIHKAN ke guru lain — harus disembunyikan
     * dari daftar "perlu diisi" dan tidak boleh dihitung sebagai hutangnya.
     *
     * @return Collection<int,string> kunci "scheduleId|Y-m-d"
     */
    public static function delegatedAwayKeys(int $teacherId): Collection
    {
        return static::keysWhere('requester_teacher_id', $teacherId);
    }

    /** Kebalikannya: kunci sesi guru lain yang kini menjadi kewajiban $teacherId. */
    public static function delegatedToKeys(int $teacherId): Collection
    {
        return static::keysWhere('substitute_teacher_id', $teacherId);
    }

    /** Sesi yang dialihkan ke $teacherId, lengkap dengan jadwal & identitas pengaju. */
    public static function delegatedToSessions(int $teacherId): Collection
    {
        return static::approvedQuery()
            ->whereHas('request', fn ($q) => $q->where('substitute_teacher_id', $teacherId))
            ->with(['schedule.subject', 'schedule.schoolClass', 'request.requester.user'])
            ->get();
    }

    /**
     * Versi batch untuk pemanggil yang mengulang banyak guru sekaligus — EWS Guru
     * mengevaluasi 97 guru dalam satu request, dan memanggil versi per-guru di dalam
     * perulangan itu berarti 194 query.
     *
     * @param  int[]  $teacherIds
     * @return array{away: array<int,string[]>, to: array<int,string[]>} keyed by teacher_id
     */
    public static function delegationMapFor(array $teacherIds): array
    {
        $sesi = static::approvedQuery()
            ->whereHas('request', fn ($q) => $q
                ->whereIn('requester_teacher_id', $teacherIds)
                ->orWhereIn('substitute_teacher_id', $teacherIds))
            ->get();

        $away = [];
        $to   = [];

        foreach ($sesi as $s) {
            $away[$s->request->requester_teacher_id][]  = $s->key();
            $to[$s->request->substitute_teacher_id][]   = $s->key();
        }

        return ['away' => $away, 'to' => $to];
    }

    /**
     * Guru yang sudah terikat pada (tanggal, jam) tertentu — untuk menandai bentrok saat
     * memilih pengganti. Mencakup sesi yang sudah dialihkan KEPADANYA: guru yang menerima
     * inval jam 08:00 tidak lagi bebas jam 08:00, meski jadwal aslinya kosong.
     */
    public static function acceptedSessionKeys(int $teacherId): Collection
    {
        return static::delegatedToKeys($teacherId);
    }

    /**
     * Kelas yang SEDANG boleh dibina $teacherId karena inval, dipetakan ke guru pengampunya.
     *
     * Dipakai Nilai Tambah: guru inval boleh memberi poin kepada siswa kelas yang ia
     * gantikan, tapi entrinya dicatat atas nama guru pengampu (nilai pengembaliannya).
     *
     * Jendelanya sengaja sama persis dengan jendela pengisian agenda: sejak tanggal sesi
     * tiba (mulai pukul 00:00, bukan menunggu bel — guru sering menyiapkan catatan sebelum
     * jam masuk) sampai `AgendaFillSetting::batasWaktu()` lewat. Memakai satu sumber aturan
     * berarti "masih bisa isi agenda sesi ini" dan "masih bisa beri nilai tambah sesi ini"
     * tidak akan pernah menjawab berbeda.
     *
     * Pengampu diambil dari `schedule.teacher_id`, BUKAN `request.requester_teacher_id`:
     * yang mengajukan inval belum tentu guru terjadwalnya, dan yang berhak atas rekap kelas
     * adalah pengampunya.
     *
     * @return array<int,int> class_id => teacher_id pengampu
     */
    public static function activeInvalClassMap(int $teacherId): array
    {
        $setting = AgendaFillSetting::instance();
        $tz      = config('app.school_timezone');
        $now     = Carbon::now($tz);

        $sesi = static::approvedQuery()
            ->whereHas('request', fn ($q) => $q->where('substitute_teacher_id', $teacherId))
            ->with('schedule')
            ->get();

        $map = [];

        foreach ($sesi as $s) {
            if (! $s->schedule || ! ($selesai = $s->selesaiPada())) {
                continue;
            }

            $mulaiHari = Carbon::parse($s->tanggal->toDateString().' 00:00', $tz);

            if ($now->lt($mulaiHari) || $now->gt($setting->batasWaktu($selesai))) {
                continue;
            }

            $map[$s->schedule->class_id] = $s->schedule->teacher_id;
        }

        return $map;
    }

    private static function keysWhere(string $column, int $teacherId): Collection
    {
        return static::approvedQuery()
            ->whereHas('request', fn ($q) => $q->where($column, $teacherId))
            ->get()
            ->map(fn (SubstitutionSession $s) => $s->key())
            ->values();
    }

    /** Hanya pengajuan yang DISETUJUI yang pernah memindahkan tanggung jawab. */
    private static function approvedQuery()
    {
        return SubstitutionSession::query()
            ->whereHas('request', fn ($q) => $q->disetujui())
            ->with('request:id,requester_teacher_id,substitute_teacher_id,status');
    }
}
