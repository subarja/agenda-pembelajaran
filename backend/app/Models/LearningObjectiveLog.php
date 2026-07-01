<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LearningObjectiveLog extends Model
{
    use HasUuid;

    const UPDATED_AT = null;

    protected $fillable = [
        'learning_objective_id', 'changed_by', 'action', 'snapshot',
    ];

    protected function casts(): array
    {
        return [
            'snapshot'   => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function learningObjective(): BelongsTo
    {
        return $this->belongsTo(LearningObjective::class);
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
