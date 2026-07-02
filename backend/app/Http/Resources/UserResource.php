<?php

namespace App\Http\Resources;

use App\Models\SchoolClass;
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
            'foto_url' => $this->foto
                ? Storage::disk('public')->url($this->foto)
                : null,

            'current_academic_year' => $this->whenLoaded('currentAcademicYear', fn () => $this->currentAcademicYear ? [
                'id'       => $this->currentAcademicYear->uuid,
                'tahun'    => $this->currentAcademicYear->tahun,
                'semester' => $this->currentAcademicYear->semester->value,
                'label'    => $this->currentAcademicYear->tahun . ' - ' . ucfirst($this->currentAcademicYear->semester->value),
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
            ->whereHas('academicYear', fn ($q) => $q->where('aktif', true))
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
