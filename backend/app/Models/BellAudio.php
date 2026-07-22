<?php

namespace App\Models;

use App\Enums\BellEvent;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class BellAudio extends Model
{
    use HasUuid, SoftDeletes;

    // "audio" tak dapat dijamakkan oleh inflector Laravel -> tabel jadi bell_audio; pin manual.
    protected $table = 'bell_audios';

    protected $fillable = [
        'nama', 'kategori', 'disk', 'path', 'durasi_detik', 'volume', 'ukuran_byte', 'uploaded_by', 'aktif',
    ];

    protected function casts(): array
    {
        return [
            'kategori' => BellEvent::class,
            'durasi_detik' => 'integer',
            'volume' => 'integer',
            'ukuran_byte' => 'integer',
            'aktif' => 'boolean',
        ];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /** URL portable (lokal maupun R2) untuk memutar audio. */
    public function url(): ?string
    {
        return $this->path ? Storage::disk($this->disk ?: 'public')->url($this->path) : null;
    }
}
