<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LearningObjectiveResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'       => $this->uuid,
            'kode'     => $this->kode,
            'deskripsi'=> $this->deskripsi,
            'urutan'   => $this->urutan,
            'semester' => $this->semester->value,
        ];
    }
}
