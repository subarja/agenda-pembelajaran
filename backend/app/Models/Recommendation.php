<?php

namespace App\Models;

use App\Enums\RecommendationStatus;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Recommendation extends Model
{
    use HasUuid;

    protected $fillable = [
        'student_id', 'threshold_id', 'akumulasi_saat_trigger',
        'status', 'ditugaskan_ke', 'hasil_tindak_lanjut',
        'ditangani_pada', 'created_by',
        'catatan_admin', 'verified_by', 'verified_at',
    ];

    protected function casts(): array
    {
        return [
            'status'                 => RecommendationStatus::class,
            'akumulasi_saat_trigger' => 'integer',
            'ditangani_pada'         => 'datetime',
            'verified_at'            => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function threshold(): BelongsTo
    {
        return $this->belongsTo(ActionThreshold::class, 'threshold_id');
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ditugaskan_ke');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function handlingSessions(): HasMany
    {
        return $this->hasMany(HandlingSession::class)->orderBy('tanggal');
    }

    // Guru/staf yang disarankan menangani bersama
    public function suggestedHandlers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'recommendation_handlers', 'recommendation_id', 'user_id')
            ->withPivot('suggested_by')
            ->withTimestamps();
    }
}
