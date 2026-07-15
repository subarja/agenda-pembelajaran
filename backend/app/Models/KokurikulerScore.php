<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Nilai kokurikuler per (projek, siswa, dimensi projek): level SB/B/C/K + catatan,
 * diisi fasilitator.
 */
class KokurikulerScore extends Model
{
    public const LEVELS = ['SB', 'B', 'C', 'K'];

    public const LEVEL_LABEL = [
        'SB' => 'Sangat Baik',
        'B'  => 'Baik',
        'C'  => 'Cukup',
        'K'  => 'Perlu Bimbingan',
    ];

    protected $fillable = ['project_id', 'student_id', 'project_dimension_id', 'level', 'catatan', 'dinilai_oleh'];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function projectDimension(): BelongsTo
    {
        return $this->belongsTo(KokurikulerProjectDimension::class, 'project_dimension_id');
    }
}
