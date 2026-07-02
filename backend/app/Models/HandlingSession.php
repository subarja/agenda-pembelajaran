<?php

namespace App\Models;

use App\Enums\HandlingSessionJenis;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HandlingSession extends Model
{
    use HasUuid;

    protected $table = 'handling_sessions';

    protected $fillable = [
        'recommendation_id', 'handled_by', 'jenis', 'is_resume',
        'tanggal', 'catatan', 'link_dokumen', 'link_foto', 'links',
    ];

    protected function casts(): array
    {
        return [
            'tanggal'   => 'date',
            'links'     => 'array',
            'is_resume' => 'boolean',
            'jenis'     => HandlingSessionJenis::class,
        ];
    }

    public function recommendation(): BelongsTo
    {
        return $this->belongsTo(Recommendation::class);
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }
}
