<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ScheduleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->uuid,
            'hari'       => $this->hari->value,
            'jam_mulai'  => $this->jam_mulai,
            'jam_selesai'=> $this->jam_selesai,
            'subject'    => [
                'id'   => $this->subject->uuid,
                'kode' => $this->subject->kode,
                'nama' => $this->subject->nama,
            ],
            'class' => [
                'id'      => $this->schoolClass->uuid,
                'tingkat' => $this->schoolClass->tingkat->value,
                'jurusan' => $this->schoolClass->jurusan,
                'rombel'  => $this->schoolClass->rombel,
                'label'   => "{$this->schoolClass->tingkat->value} {$this->schoolClass->jurusan} - {$this->schoolClass->rombel}",
            ],
            'agenda_hari_ini' => $this->whenLoaded('agendas', function () {
                $today = $this->agendas->first();
                return $today ? [
                    'id'     => $today->uuid,
                    'status' => $today->status->value,
                ] : null;
            }),
        ];
    }
}
