<?php

namespace App\Models;

use App\Enums\BkStatus;
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
        'student_id', 'threshold_id', 'alasan_manual', 'akumulasi_saat_trigger',
        'status', 'ditugaskan_ke', 'hasil_tindak_lanjut',
        'ditangani_pada', 'created_by',
        'catatan_admin', 'verified_by', 'verified_at',
        // GK8-GK11: eskalasi ke BK
        'bk_status', 'bk_teacher_id', 'diajukan_konseling_pada',
        'diterima_bk_pada', 'resume_bk', 'bk_selesai_pada',
    ];

    protected function casts(): array
    {
        return [
            'status'                  => RecommendationStatus::class,
            'bk_status'               => BkStatus::class,
            'akumulasi_saat_trigger'  => 'integer',
            'ditangani_pada'          => 'datetime',
            'verified_at'             => 'datetime',
            'diajukan_konseling_pada' => 'datetime',
            'diterima_bk_pada'        => 'datetime',
            'bk_selesai_pada'         => 'datetime',
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

    public function bkTeacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'bk_teacher_id');
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
