<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Laporan singkat harian fasilitator per kelas — satu entri per
 * (projek, kelas, tanggal).
 */
class KokurikulerReport extends Model
{
    use HasAuditTrail, HasUuid;

    protected $fillable = ['project_id', 'class_id', 'tanggal', 'isi', 'created_by', 'updated_by'];

    protected function casts(): array
    {
        return ['tanggal' => 'date'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(KokurikulerProject::class, 'project_id');
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }
}
