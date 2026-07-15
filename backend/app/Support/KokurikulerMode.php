<?php

namespace App\Support;

use App\Models\AcademicYear;
use App\Models\KokurikulerProject;
use App\Models\KokurikulerProjectClass;
use App\Models\User;
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
        return AcademicYear::where('aktif', true)->value('id');
    }

    /**
     * Periode pembebasan tagihan agenda per kelas: seluruh projek NON-draft
     * (aktif ATAU selesai — projek yang sudah selesai tetap membebaskan tanggal
     * lamanya, supaya sesi selama kokurikuler tidak pernah menjadi hutang tagihan).
     *
     * @return Collection keyed class_id → Collection baris {tanggal_mulai, tanggal_selesai}
     */
    public static function agendaExemptPeriods(): Collection
    {
        return static::$exemptCache ??= KokurikulerProjectClass::query()
            ->join('kokurikuler_projects as p', 'p.id', '=', 'kokurikuler_project_classes.project_id')
            ->where('p.status', '!=', 'draft')
            ->whereNull('p.deleted_at')
            ->get(['kokurikuler_project_classes.class_id', 'p.tanggal_mulai', 'p.tanggal_selesai'])
            ->groupBy('class_id');
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

        return $periods !== null && $periods->contains(fn ($p) =>
            $tanggal >= substr((string) $p->tanggal_mulai, 0, 10)
            && $tanggal <= substr((string) $p->tanggal_selesai, 0, 10));
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
            'aktif'          => $isFasilitator || $isPeserta,
            'is_fasilitator' => $isFasilitator,
            'is_peserta'     => $isPeserta,
        ];
    }
}
