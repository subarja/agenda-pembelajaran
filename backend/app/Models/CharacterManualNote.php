<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CharacterManualNote extends Model
{
    use HasUuid;

    protected $fillable = [
        'academic_year_id', 'student_id', 'teacher_id', 'atas_nama_teacher_id', 'sumber', 'catatan', 'nilai',
        'status', 'admin_catatan', 'nilai_final',
        'reviewed_by', 'reviewed_at',
    ];

    protected $casts = [
        'nilai'       => 'integer',
        'nilai_final' => 'integer',
        'reviewed_at' => 'datetime',
    ];

    // Nilai Tambah dilaporkan per semester — tanpa penanda ini laporan kelas TA baru
    // ikut memuat nilai yang diberikan saat siswa masih di tingkat sebelumnya.
    protected static function booted(): void
    {
        static::creating(function (self $m) {
            $m->academic_year_id ??= \App\Support\TahunAjaran::id();
        });
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    /** Scope ke TA tertentu (default TA aktif) — riwayat & laporan Nilai Tambah per semester. */
    public function scopeTahunAjaran(\Illuminate\Database\Eloquent\Builder $q, ?int $academicYearId = null): \Illuminate\Database\Eloquent\Builder
    {
        $ayId = $academicYearId ?? \App\Support\TahunAjaran::id();

        return $ayId === null ? $q : $q->where('academic_year_id', $ayId);
    }

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
