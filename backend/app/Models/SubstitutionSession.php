<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Satu sesi yang dicakup sebuah pengajuan inval: pasangan (jadwal, tanggal).
 *
 * `slot_aktif` TIDAK boleh ditulis dari luar — hanya lewat SubstitutionRequest::pindahStatus(),
 * karena ia adalah kunci unik yang menjamin satu sesi cuma punya satu pengajuan hidup.
 */
class SubstitutionSession extends Model
{
    protected $fillable = ['request_id', 'schedule_id', 'tanggal', 'slot_aktif'];

    protected function casts(): array
    {
        return ['tanggal' => 'date'];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(SubstitutionRequest::class, 'request_id');
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class);
    }

    /** Kunci gabungan yang dipakai SessionTeacher untuk pencocokan cepat di memori. */
    public function key(): string
    {
        return $this->schedule_id.'|'.$this->tanggal->toDateString();
    }

    /** Waktu sesi ini benar-benar berakhir (tanggal + jam_selesai jadwal), zona sekolah. */
    public function selesaiPada(): ?Carbon
    {
        if (! $this->schedule) {
            return null;
        }

        return Carbon::parse(
            $this->tanggal->toDateString().' '.$this->schedule->jam_selesai,
            config('app.school_timezone'),
        );
    }
}
