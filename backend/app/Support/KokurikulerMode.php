<?php

namespace App\Support;

use App\Models\AgendaFillSetting;
use App\Models\KokurikulerProject;
use App\Models\KokurikulerProjectClass;
use App\Models\KokurikulerReport;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Satu-satunya sumber kebenaran untuk gating modul Kokurikuler: siapa yang punya
 * menu (fasilitator kelas peserta / siswa kelas peserta) dan projek mana yang
 * sedang berjalan pada tahun ajaran aktif. Pola sama dengan PklMode.
 */
class KokurikulerMode
{
    /** Cache per-request peta pembebasan tagihan agenda (lihat agendaExemptPeriods). */
    protected static ?Collection $exemptCache = null;

    public static function activeAcademicYearId(): ?int
    {
        return TahunAjaran::id();
    }

    /**
     * Periode pembebasan tagihan agenda per kelas: seluruh projek NON-draft
     * (aktif ATAU selesai — projek yang sudah selesai tetap membebaskan tanggal
     * lamanya, supaya sesi selama kokurikuler tidak pernah menjadi hutang tagihan).
     *
     * Dua sumber, digabung:
     *  1. Baris kelas peserta eksplisit (kokurikuler_project_classes).
     *  2. Field `tingkat` projek ('XI' / 'XI,XII' / null = semua tingkat): SEMUA kelas
     *     ber-tingkat itu pada TA projek ikut bebas. Dulu hanya sumber (1) — projek
     *     yang "diset aktif kelas XI" tapi daftar kelasnya tidak lengkap membuat guru
     *     kelas XI yang tak terdaftar tetap ditagih agenda reguler.
     *
     * @return Collection keyed class_id → Collection baris {tanggal_mulai, tanggal_selesai}
     */
    public static function agendaExemptPeriods(): Collection
    {
        if (static::$exemptCache !== null) {
            return static::$exemptCache;
        }

        $explicit = KokurikulerProjectClass::query()
            ->join('kokurikuler_projects as p', 'p.id', '=', 'kokurikuler_project_classes.project_id')
            ->where('p.status', '!=', 'draft')
            ->whereNull('p.deleted_at')
            ->get(['kokurikuler_project_classes.class_id', 'p.status', 'p.tanggal_mulai', 'p.tanggal_selesai', 'p.selesai_pada'])
            ->map(fn ($r) => (object) [
                'class_id' => $r->class_id,
                'tanggal_mulai' => $r->tanggal_mulai,
                'tanggal_selesai' => static::batasAkhirEfektif($r->status, $r->tanggal_selesai, $r->selesai_pada),
            ]);

        $byTingkat = KokurikulerProject::query()
            ->where('status', '!=', 'draft')
            ->get(['id', 'academic_year_id', 'tingkat', 'status', 'tanggal_mulai', 'tanggal_selesai', 'selesai_pada'])
            ->flatMap(function ($p) {
                $tingkat = $p->tingkat !== null
                    ? array_map('trim', explode(',', $p->tingkat))
                    : null; // null = semua tingkat

                $batasAkhir = static::batasAkhirEfektif($p->status, $p->tanggal_selesai, $p->selesai_pada);

                return SchoolClass::where('academic_year_id', $p->academic_year_id)
                    ->when($tingkat, fn ($q) => $q->whereIn('tingkat', $tingkat))
                    ->pluck('id')
                    ->map(fn ($classId) => (object) [
                        'class_id' => $classId,
                        'tanggal_mulai' => $p->tanggal_mulai,
                        'tanggal_selesai' => $batasAkhir,
                    ]);
            });

        return static::$exemptCache = $explicit->concat($byTingkat)->groupBy('class_id');
    }

    /**
     * Batas akhir pembebasan yang BERLAKU untuk sebuah projek.
     * - Projek 'selesai' yang ditutup LEBIH AWAL (punya `selesai_pada` < tanggal
     *   terjadwal): pembebasan berhenti di hari penutupan, sehingga kelas langsung
     *   kembali ke mode mengajar reguler tanpa menunggu tanggal_selesai.
     * - Selain itu (aktif, atau selesai tanpa `selesai_pada` = data lama): pakai
     *   tanggal_selesai terjadwal penuh — perilaku lama, tanggal projek tetap bebas
     *   agar tak berubah jadi hutang tagihan.
     *
     * @param  mixed  $tanggalSelesai  Carbon|string
     * @param  mixed  $selesaiPada  Carbon|string|null
     */
    protected static function batasAkhirEfektif(?string $status, $tanggalSelesai, $selesaiPada): string
    {
        $selesai = substr((string) $tanggalSelesai, 0, 10);

        if ($status === 'selesai' && $selesaiPada !== null && $selesaiPada !== '') {
            $pada = substr((string) $selesaiPada, 0, 10);

            return $pada < $selesai ? $pada : $selesai;
        }

        return $selesai;
    }

    /** Reset cache statis — dipakai test & setelah CRUD projek. */
    public static function flush(): void
    {
        static::$exemptCache = null;
    }

    /**
     * Apakah sesi (kelas, tanggal) DIBEBASKAN dari kewajiban mengisi agenda reguler?
     * Berlaku untuk kelas peserta projek kokurikuler pada tanggal dalam periode projek.
     * Kewajiban agenda PKL mingguan TIDAK terpengaruh oleh ini.
     */
    public static function isAgendaExempt(?int $classId, string $tanggal): bool
    {
        if ($classId === null) {
            return false;
        }

        $periods = static::agendaExemptPeriods()->get($classId);

        return $periods !== null && $periods->contains(fn ($p) => $tanggal >= substr((string) $p->tanggal_mulai, 0, 10)
            && $tanggal <= substr((string) $p->tanggal_selesai, 0, 10));
    }

    /**
     * Tagihan laporan harian kokurikuler untuk fasilitator — mitra dari tagihan agenda
     * reguler: satu baris per (projek aktif, kelas yang ia fasilitasi, tanggal
     * pelaksanaan Senin–Sabtu) yang laporan hariannya belum ada, dibatasi jendela yang
     * sama dengan agenda reguler ($mulai..$today, deadline = akhir hari + batas admin).
     * Bentuk barisnya sengaja identik dengan baris /agendas/perlu-diisi.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function tagihanFasilitator(
        User $user,
        Carbon $mulai,
        Carbon $today,
        AgendaFillSetting $setting,
    ): array {
        $slots = KokurikulerProjectClass::where('fasilitator_user_id', $user->id)
            ->whereHas('project', fn ($q) => $q->berjalan())
            ->with(['project', 'schoolClass'])
            ->get();

        if ($slots->isEmpty()) {
            return [];
        }

        $now = Carbon::now('Asia/Jakarta');
        $rows = [];

        foreach ($slots as $pc) {
            $p = $pc->project;
            $class = $pc->schoolClass;
            if (! $p || ! $class) {
                continue;
            }

            $dari = $p->tanggal_mulai->greaterThan($mulai) ? $p->tanggal_mulai->copy() : $mulai->copy();
            $sampai = $p->tanggal_selesai->lessThan($today) ? $p->tanggal_selesai->copy() : $today->copy();
            if ($dari->gt($sampai)) {
                continue;
            }

            $terisi = KokurikulerReport::where('project_id', $p->id)
                ->where('class_id', $class->id)
                ->whereBetween('tanggal', [$dari->toDateString(), $sampai->toDateString()])
                ->pluck('tanggal')
                ->map(fn ($t) => substr((string) $t, 0, 10))
                ->flip();

            for ($d = $dari->copy(); $d->lte($sampai); $d->addDay()) {
                if ($d->isSunday() || $terisi->has($d->toDateString())) {
                    continue; // hari Minggu bukan hari pelaksanaan (pola projectDates())
                }

                // Sama seperti sesi reguler: tanggal di luar rentang semester aktif atau
                // hari tidak efektif tidak pernah ditagih — periode projek bisa saja
                // menyentuh tanggal sebelum semester mulai atau hari libur kalender.
                if (! TanggalTagihan::ditagih($d->toDateString())) {
                    continue;
                }

                $deadline = $setting->batasWaktu($d->copy()->endOfDay());
                $rows[] = [
                    'jenis' => 'kokurikuler',
                    // Kunci unik utk daftar FE — bukan uuid jadwal sungguhan.
                    'schedule_id' => "kokurikuler|{$p->uuid}|{$class->uuid}",
                    'tanggal' => $d->toDateString(),
                    'hari' => ucfirst($d->locale('id')->dayName),
                    'jam_mulai' => '',
                    'jam_selesai' => '',
                    'class_id' => $class->uuid,
                    'kelas' => $class->label(),
                    'mapel' => "Kokurikuler — {$p->judul}",
                    'deadline' => $deadline->format('Y-m-d H:i'),
                    'bisa_diisi' => $now->lte($deadline),
                    'jam_tersisa' => $now->lte($deadline) ? $now->diffInHours($deadline) : null,
                ];
            }
        }

        return $rows;
    }

    /**
     * Status menu Kokurikuler untuk seorang user.
     * Menu muncul selama ada projek berstatus 'aktif' di TA aktif yang melibatkan
     * user tersebut (sebagai fasilitator kelas, atau sebagai siswa kelas peserta).
     */
    public static function statusFor(User $user): array
    {
        $activeProjects = KokurikulerProject::berjalan()->select('id');

        if (! KokurikulerProject::berjalan()->exists()) {
            return ['aktif' => false, 'is_fasilitator' => false, 'is_peserta' => false];
        }

        $isFasilitator = KokurikulerProjectClass::where('fasilitator_user_id', $user->id)
            ->whereIn('project_id', $activeProjects)
            ->exists();

        $isPeserta = $user->student
            ? KokurikulerProjectClass::where('class_id', $user->student->class_id)
                ->whereIn('project_id', $activeProjects)
                ->exists()
            : false;

        return [
            'aktif' => $isFasilitator || $isPeserta,
            'is_fasilitator' => $isFasilitator,
            'is_peserta' => $isPeserta,
        ];
    }
}
