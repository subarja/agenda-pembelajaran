<?php

namespace App\Http\Resources;

use App\Support\BellSchedule;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AgendaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->uuid,
            'tanggal'    => $this->tanggal->format('Y-m-d'),
            'resume_kbm' => $this->resume_kbm,
            'status'     => $this->status->value,
            'created_at' => $this->created_at->toISOString(),
            'updated_at' => $this->updated_at->toISOString(),

            'schedule' => $this->whenLoaded('schedule', fn () => [
                'id'          => $this->schedule->uuid,
                'hari'        => $this->schedule->hari->value,
                ...BellSchedule::resolve($this->schedule, $this->tanggal->format('Y-m-d')),
                'subject'     => [
                    'id'   => $this->schedule->subject->uuid,
                    'kode' => $this->schedule->subject->kode,
                    'nama' => $this->schedule->subject->nama,
                ],
                'class' => [
                    'id'      => $this->schedule->schoolClass->uuid,
                    'tingkat' => $this->schedule->schoolClass->tingkat->value,
                    'jurusan' => $this->schedule->schoolClass->jurusan,
                    'rombel'  => $this->schedule->schoolClass->rombel,
                    'label'   => $this->schedule->schoolClass->label(),
                ],
            ]),

            'learning_objectives' => $this->whenLoaded(
                'learningObjectives',
                fn () => LearningObjectiveResource::collection($this->learningObjectives),
            ),

            'student_scores' => $this->whenLoaded('studentScores', fn () =>
                $this->studentScores->map(fn ($s) => [
                    'student_id' => $s->student->uuid,
                    'nama'       => $s->student->user->nama,
                    'nis'        => $s->student->nis,
                    'nilai'      => $s->nilai,
                    'catatan'    => $s->catatan,
                ])
            ),
        ];
    }
}
