<?php

namespace App\Models;

use App\Enums\RecommendationStatus;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Recommendation extends Model
{
    use HasUuid;

    protected $fillable = [
        'student_id', 'threshold_id', 'akumulasi_saat_trigger',
        'status', 'ditugaskan_ke', 'hasil_tindak_lanjut',
        'ditangani_pada', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status'                 => RecommendationStatus::class,
            'akumulasi_saat_trigger' => 'integer',
            'ditangani_pada'         => 'datetime',
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
}
