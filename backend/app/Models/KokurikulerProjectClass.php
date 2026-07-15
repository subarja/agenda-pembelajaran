<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Kelas peserta projek kokurikuler. Fasilitator default = wali kelas saat kelas
 * ditambahkan; admin boleh menggantinya per kelas.
 */
class KokurikulerProjectClass extends Model
{
    protected $fillable = ['project_id', 'class_id', 'fasilitator_user_id'];

    public function project(): BelongsTo
    {
        return $this->belongsTo(KokurikulerProject::class, 'project_id');
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function fasilitator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'fasilitator_user_id');
    }
}
