<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CharacterManualNote extends Model
{
    use HasUuid;

    protected $fillable = [
        'student_id', 'teacher_id', 'atas_nama_teacher_id', 'sumber', 'catatan', 'nilai',
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

    /** Guru yang MEMBERI nilai — bisa guru inval. */
    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    /** Guru PENGAMPU kelas, pemilik entri ini di rekap. Sama dengan teacher() kecuali inval. */
    public function atasNamaTeacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'atas_nama_teacher_id');
    }

    /** Entri ini diberikan oleh guru pengganti, bukan pengampunya. */
    public function diberikanOlehInval(): bool
    {
        return $this->atas_nama_teacher_id !== null
            && $this->atas_nama_teacher_id !== $this->teacher_id;
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
