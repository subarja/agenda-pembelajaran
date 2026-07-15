<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KokurikulerTeamMember extends Model
{
    protected $fillable = ['team_id', 'student_id'];

    public function team(): BelongsTo
    {
        return $this->belongsTo(KokurikulerTeam::class, 'team_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }
}
