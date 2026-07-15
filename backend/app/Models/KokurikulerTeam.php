<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Tim projek kokurikuler dalam satu kelas (nomor 1..n, nama opsional).
 */
class KokurikulerTeam extends Model
{
    protected $fillable = ['project_id', 'class_id', 'nomor', 'nama'];

    public function project(): BelongsTo
    {
        return $this->belongsTo(KokurikulerProject::class, 'project_id');
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(KokurikulerTeamMember::class, 'team_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(KokurikulerDocument::class, 'team_id');
    }
}
