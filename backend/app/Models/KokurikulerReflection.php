<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Refleksi siswa projek kokurikuler: 'harian' (satu per tanggal) dan 'akhir'
 * (satu per projek; kunci upsert-nya (project, student, jenis) di controller).
 */
class KokurikulerReflection extends Model
{
    public const JENIS_HARIAN = 'harian';
    public const JENIS_AKHIR  = 'akhir';

    protected $fillable = ['project_id', 'student_id', 'jenis', 'tanggal', 'isi'];

    protected function casts(): array
    {
        return ['tanggal' => 'date'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(KokurikulerProject::class, 'project_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
