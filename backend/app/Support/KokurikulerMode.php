<?php

namespace App\Support;

use App\Models\AcademicYear;
use App\Models\KokurikulerProject;
use App\Models\KokurikulerProjectClass;
use App\Models\User;

/**
 * Satu-satunya sumber kebenaran untuk gating modul Kokurikuler: siapa yang punya
 * menu (fasilitator kelas peserta / siswa kelas peserta) dan projek mana yang
 * sedang berjalan pada tahun ajaran aktif. Pola sama dengan PklMode.
 */
class KokurikulerMode
{
    public static function activeAcademicYearId(): ?int
    {
        return AcademicYear::where('aktif', true)->value('id');
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
