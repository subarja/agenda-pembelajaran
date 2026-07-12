<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu baris = satu keanggotaan siswa di satu kelas (kelas sudah terikat TA).
 * `status` menerangkan bagaimana keanggotaan itu berakhir:
 * aktif (masih anggota) | naik | tinggal | lulus | pindah.
 *
 * Baris dibuat/ditutup otomatis oleh hook di model Student saat class_id berubah;
 * PromotionController menimpa status penutup dengan yang lebih spesifik.
 */
class ClassEnrollment extends Model
{
    protected $table = 'class_student';

    protected $fillable = ['class_id', 'student_id', 'status'];

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
