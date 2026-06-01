<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HandlingSession extends Model
{
    use HasUuid;

    protected $table = 'handling_sessions';

    protected $fillable = [
        'recommendation_id', 'handled_by',
        'tanggal', 'catatan', 'link_dokumen', 'link_foto',
    ];

    protected function casts(): array
    {
        return ['tanggal' => 'date'];
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
