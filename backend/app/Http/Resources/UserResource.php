<?php

namespace App\Http\Resources;

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

            'teacher' => $this->whenLoaded('teacher', fn () => [
                'id'             => $this->teacher->uuid,
                'nip'            => $this->teacher->nip,
                'mapel_utama'    => $this->teacher->mapel_utama,
                'nomor_hp'       => $this->teacher->nomor_hp,
                'gelar_depan'    => $this->teacher->gelar_depan,
                'gelar_belakang' => $this->teacher->gelar_belakang,
            ]),

            'student' => $this->whenLoaded('student', fn () => [
                'id'    => $this->student->uuid,
                'nis'   => $this->student->nis,
                'nisn'  => $this->student->nisn,
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
}
