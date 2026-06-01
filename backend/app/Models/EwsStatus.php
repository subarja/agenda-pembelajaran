<?php

namespace App\Models;

use App\Enums\EwsLevel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EwsStatus extends Model
{
    protected $table = 'ews_statuses';

    protected $fillable = [
        'student_id', 'academic_year_id', 'level',
        'kehadiran_score', 'karakter_score',
        'catatan_count', 'nilai_score',
        'last_calculated_at',
    ];

    protected function casts(): array
    {
        return [
            'level'              => EwsLevel::class,
            'kehadiran_score'    => 'decimal:2',
            'karakter_score'     => 'integer',
            'catatan_count'      => 'integer',
            'nilai_score'        => 'decimal:2',
            'last_calculated_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }
}
