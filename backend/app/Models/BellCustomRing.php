<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Jadwal bunyi kustom: "pada pukul {waktu}, bunyikan {audio}" pada hari-hari tertentu
 * (atau setiap hari bila hari kosong). Jam dinding tetap, tidak digeser mode Apel/Tanpa Apel.
 */
class BellCustomRing extends Model
{
    use HasUuid;

    protected $fillable = ['nama', 'waktu', 'bell_audio_id', 'hari', 'aktif'];

    protected function casts(): array
    {
        return [
            'hari' => 'array',
            'aktif' => 'boolean',
        ];
    }

    public function audio(): BelongsTo
    {
        return $this->belongsTo(BellAudio::class, 'bell_audio_id');
    }

    /** Berlaku pada nama hari (lowercase id) tertentu? Kosong/null = setiap hari. */
    public function berlakuPada(string $namaHari): bool
    {
        return empty($this->hari) || in_array($namaHari, $this->hari, true);
    }
}
