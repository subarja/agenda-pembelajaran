<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id', 'action', 'target_type', 'target_id',
        'payload', 'ip', 'user_agent', 'timestamp',
    ];

    protected function casts(): array
    {
        return [
            'payload'   => 'array',
            'timestamp' => 'datetime',
        ];
    }

    public static function record(string $action, ?Model $target = null, array $payload = [], ?int $actorId = null): static
    {
        return static::create([
            'user_id'     => $actorId ?? auth()->id(),
            'action'      => $action,
            'target_type' => $target ? get_class($target) : null,
            'target_id'   => $target?->getKey(),
            'payload'     => $payload,
            'ip'          => request()->ip(),
            'user_agent'  => request()->userAgent(),
            'timestamp'   => now(),
        ]);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
