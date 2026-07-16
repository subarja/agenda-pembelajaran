<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Penugasan mengajar dari lesson aSc (guru × mapel × kelas + JP/minggu),
 * terpisah dari ploting grid (Schedule). Diisi ulang penuh setiap import XML
 * untuk kelas-kelas yang ada di file. Sumber baris "belum diplot" di menu
 * Beban Mengajar.
 */
class TeachingAssignment extends Model
{
    protected $fillable = ['class_id', 'subject_id', 'teacher_id', 'jp_per_minggu'];

    protected function casts(): array
    {
        return ['jp_per_minggu' => 'float'];
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }
}
