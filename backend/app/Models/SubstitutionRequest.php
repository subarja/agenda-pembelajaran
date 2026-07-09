<?php

namespace App\Models;

use App\Enums\SubstitutionStatus;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Pengajuan guru inval: satu pengaju, satu guru pengganti, satu atau beberapa sesi.
 *
 * Satu pengajuan boleh mencakup beberapa sesi sekaligus (kasus lazim: guru sakit sehari
 * punya 3–4 sesi). Guru pengganti menjawab SEKALI untuk seluruh pengajuan — bukan per
 * sesi — supaya tidak ada keadaan setengah disetujui yang membuat "siapa yang mengajar"
 * jadi ambigu di tengah hari.
 */
class SubstitutionRequest extends Model
{
    use HasUuid, SoftDeletes;

    protected $fillable = [
        'requester_teacher_id', 'substitute_teacher_id',
        'alasan', 'pesan', 'link_tugas',
        'status', 'alasan_penolakan', 'responded_at',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'status'       => SubstitutionStatus::class,
            'responded_at' => 'datetime',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'requester_teacher_id');
    }

    public function substitute(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'substitute_teacher_id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(SubstitutionSession::class, 'request_id');
    }

    public function scopeAktif(Builder $query): Builder
    {
        return $query->whereIn('status', [SubstitutionStatus::Diajukan, SubstitutionStatus::Disetujui]);
    }

    public function scopeDisetujui(Builder $query): Builder
    {
        return $query->where('status', SubstitutionStatus::Disetujui);
    }

    /**
     * Pindahkan status + jaga kunci sesi dalam satu transaksi.
     *
     * `slot_aktif` pada tabel sesi adalah satu-satunya yang mencegah dua pengajuan aktif
     * atas sesi yang sama (lihat migrasi). Ia HARUS berubah bersama status; memisahkannya
     * membuka jendela di mana index unique tidak lagi mencerminkan kenyataan.
     */
    public function pindahStatus(SubstitutionStatus $status, ?int $actorUserId = null, ?string $alasanPenolakan = null): void
    {
        $this->forceFill([
            'status'           => $status,
            'alasan_penolakan' => $alasanPenolakan,
            'responded_at'     => in_array($status, [SubstitutionStatus::Disetujui, SubstitutionStatus::Ditolak], true)
                ? now()
                : $this->responded_at,
            'updated_by'       => $actorUserId ?? $this->updated_by,
        ])->save();

        $this->sessions()->update(['slot_aktif' => $status->aktif() ? 1 : null]);
    }

    /** Sesi paling akhir dalam pengajuan ini — penentu kapan pengajuan kedaluwarsa. */
    public function sesiTerakhirSelesaiPada(): ?\Illuminate\Support\Carbon
    {
        $sesi = $this->sessions()->with('schedule')->get()
            ->map(fn (SubstitutionSession $s) => $s->selesaiPada())
            ->filter();

        return $sesi->isEmpty() ? null : $sesi->max();
    }
}
