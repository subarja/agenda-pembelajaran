<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class StudentCaseNote extends Model
{
    use HasUuid, SoftDeletes;

    protected $fillable = [
        'student_id', 'author_id', 'jenis',
        'catatan', 'tindak_lanjut', 'tanggal', 'konfidensial',
    ];

    protected $casts = [
        'tanggal'     => 'date',
        'konfidensial' => 'boolean',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
