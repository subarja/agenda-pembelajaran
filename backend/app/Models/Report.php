<?php

namespace App\Models;

use App\Enums\ReportJenis;
use App\Enums\ReportStatus;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    use HasUuid;

    protected $fillable = [
        'jenis', 'periode', 'filter_json', 'status',
        'generated_url', 'generated_at', 'generated_by',
    ];

    protected function casts(): array
    {
        return [
            'jenis'        => ReportJenis::class,
            'status'       => ReportStatus::class,
            'filter_json'  => 'array',
            'generated_at' => 'datetime',
        ];
    }

    public function generatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }
}
