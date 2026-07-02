<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LearningObjectiveResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->uuid,
            'kode'       => $this->kode,
            'deskripsi'  => $this->deskripsi,
            'urutan'     => $this->urutan,
            'semester'   => $this->semester->value,
            'fase'       => $this->fase,
            'aktif'      => $this->aktif,
            'updated_by' => $this->whenLoaded('updatedByUser', fn () => $this->updatedByUser?->nama),
            'updated_at' => $this->updated_at?->format('Y-m-d H:i'),
        ];
    }
}
