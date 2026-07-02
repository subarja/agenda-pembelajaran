<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CharacterManualNote extends Model
{
    use HasUuid;

    protected $fillable = [
        'student_id', 'teacher_id', 'sumber', 'catatan', 'nilai',
        'status', 'admin_catatan', 'nilai_final',
        'reviewed_by', 'reviewed_at',
    ];

    protected $casts = [
        'nilai'       => 'integer',
        'nilai_final' => 'integer',
        'reviewed_at' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
