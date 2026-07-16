<?php

namespace App\Http\Resources;

use App\Models\SchoolClass;
use App\Support\KokurikulerMode;
use App\Support\PklMode;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'       => $this->uuid,
            'nama'     => $this->nama,
            'email'    => $this->email,
            'role'     => $this->role->value,
            'status'   => $this->status->value,
            'nomor_hp' => $this->nomor_hp,
            'must_change_password' => (bool) $this->must_change_password,
            'foto_url' => $this->foto
                ? Storage::disk('public')->url($this->foto)
                : null,

            'current_academic_year' => $this->whenLoaded('currentAcademicYear', fn () => $this->currentAcademicYear ? [
                'id'       => $this->currentAcademicYear->uuid,
                'tahun'    => $this->currentAcademicYear->tahun,
                'semester' => $this->currentAcademicYear->semester->value,
                'label'    => $this->currentAcademicYear->tahun . ' - ' . ucfirst($this->currentAcademicYear->semester->value),
                'aktif'    => (bool) $this->currentAcademicYear->aktif,
                // TA arsip default baca-saja; admin bisa membuka lewat saklar Pengaturan.
                'tulis_diizinkan' => $this->currentAcademicYear->aktif
                    || \App\Models\ArchiveWriteSetting::instance()->izinkan_tulis,
            ] : null),

            'teacher' => $this->whenLoaded('teacher', fn () => [
                'id'             => $this->teacher->uuid,
                'nip'            => $this->teacher->nip,
                'mapel_utama'    => $this->teacher->mapel_utama,
                'nomor_hp'       => $this->teacher->nomor_hp,
                'gelar_depan'    => $this->teacher->gelar_depan,
                'gelar_belakang' => $this->teacher->gelar_belakang,
                'is_bk'          => (bool) $this->teacher->is_bk,
            ]),

            'kapabilitas' => $this->whenLoaded('teacher', fn () => $this->computeKapabilitas()),

            // Status Mode PKL untuk gating menu di frontend — hanya dihitung saat mode
            // aktif (menghindari query sia-sia ketika PKL mati). `is_pembimbing` kini
            // berarti "berhak masuk alur agenda PKL": pembimbing (penugasan) ATAU
            // ber-ploting jadwal kelas XII — keduanya mengisi agenda PKL mingguan.
            'pkl' => [
                'mode_aktif'    => PklMode::isActive(),
                'is_pembimbing' => PklMode::isActive()
                    && $this->relationLoaded('teacher') && $this->teacher
                    && PklMode::canFillAgenda($this->resource),
            ],

            // Status modul Kokurikuler — menu muncul selama ada projek aktif di TA aktif
            // yang melibatkan user ini (fasilitator kelas peserta / siswa kelas peserta).
            'kokurikuler' => KokurikulerMode::statusFor($this->resource),

            'student' => $this->whenLoaded('student', fn () => [
                'id'    => $this->student->uuid,
                'nis'   => $this->student->nis,
                'nisn'  => $this->student->nisn,
                // Foto RESMI siswa (kolom students.foto, dikelola admin/wali kelas) — beda
                // dari foto_url di atas (users.foto) yang untuk siswa sengaja tidak dipakai.
                'foto_url' => $this->student->foto ? Storage::disk('public')->url($this->student->foto) : null,
                'kelas' => $this->student->schoolClass
                    ? [
                        'tingkat' => $this->student->schoolClass->tingkat->value,
                        'jurusan' => $this->student->schoolClass->jurusan,
                        'rombel'  => $this->student->schoolClass->rombel,
                    ]
                    : null,
            ]),

            'linked_student' => $this->whenLoaded('linkedStudent', fn () => $this->linkedStudent ? [
                'id'    => $this->linkedStudent->uuid,
                'nama'  => $this->linkedStudent->user?->nama,
                'nis'   => $this->linkedStudent->nis,
                'nisn'  => $this->linkedStudent->nisn,
                'kelas' => $this->linkedStudent->schoolClass
                    ? [
                        'tingkat' => $this->linkedStudent->schoolClass->tingkat->value,
                        'jurusan' => $this->linkedStudent->schoolClass->jurusan,
                        'rombel'  => $this->linkedStudent->schoolClass->rombel,
                    ]
                    : null,
            ] : null),
        ];
    }

    private function computeKapabilitas(): array
    {
        $isBk = (bool) ($this->teacher?->is_bk ?? false);

        $kelasWali = SchoolClass::where('wali_kelas_id', $this->id)
            ->where('academic_year_id', \App\Support\TahunAjaran::id())
            ->first();

        $isWaliKelas   = $kelasWali !== null;
        $waliKelasClass = $kelasWali ? [
            'id'    => $kelasWali->uuid,
            'label' => $kelasWali->tingkat->value . ' ' . $kelasWali->jurusan . ' - ' . $kelasWali->rombel,
        ] : null;

        return [
            'is_bk'            => $isBk,
            'is_wali_kelas'    => $isWaliKelas,
            'wali_kelas_class' => $waliKelasClass,
        ];
    }
}
