<?php

namespace App\Models;

use App\Enums\NoteKategori;
use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Note extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'target_type', 'target_id',
        'kategori', 'isi', 'tindak_lanjut',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'kategori' => NoteKategori::class,
        ];
    }

    public function target(): MorphTo
    {
        return $this->morphTo();
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
