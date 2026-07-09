<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PushSubscription extends Model
{
    protected $fillable = ['user_id', 'token', 'device_label', 'user_agent', 'last_used_at'];

    protected $casts = ['last_used_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Catat/segarkan token milik $user.
     *
     * updateOrCreate dikunci pada `token` saja — BUKAN pada [user_id, token]. Browser
     * memberi token yang identik untuk profil browser yang sama, jadi kalau guru A
     * logout lalu guru B login di HP yang sama, baris itu harus BERPINDAH ke guru B.
     * Mengunci pada pasangan [user_id, token] akan gagal di unique index token dan —
     * lebih buruk lagi kalau index-nya tidak ada — membuat guru B menerima push milik
     * guru A selamanya.
     */
    public static function remember(User $user, string $token, ?string $deviceLabel, ?string $userAgent): self
    {
        return static::updateOrCreate(
            ['token' => $token],
            [
                'user_id'      => $user->id,
                'device_label' => $deviceLabel,
                'user_agent'   => $userAgent ? mb_substr($userAgent, 0, 512) : null,
                'last_used_at' => now(),
            ],
        );
    }
}
