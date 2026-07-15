<?php

namespace App\Models;

use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tautan dokumen hasil projek per tim (Google Drive/Docs dsb.) — hanya link,
 * bukan upload file. Ditambahkan anggota tim, bisa dihapus pemilik/fasilitator.
 */
class KokurikulerDocument extends Model
{
    use HasUuid;

    protected $fillable = ['team_id', 'judul', 'url', 'created_by'];

    public function team(): BelongsTo
    {
        return $this->belongsTo(KokurikulerTeam::class, 'team_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
