<?php

namespace App\Models;

use App\Enums\Semester;
use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AcademicYear extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'tahun', 'semester', 'aktif', 'locked',
        'tanggal_mulai', 'tanggal_selesai',
        'wk_kurikulum_gelar_depan', 'wk_kurikulum_nama', 'wk_kurikulum_gelar_belakang', 'wk_kurikulum_nip',
        'kepala_sekolah_gelar_depan', 'kepala_sekolah_nama', 'kepala_sekolah_gelar_belakang', 'kepala_sekolah_nip',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'semester'       => Semester::class,
            'aktif'          => 'boolean',
            'locked'         => 'boolean',
            'tanggal_mulai'  => 'date',
            'tanggal_selesai'=> 'date',
        ];
    }

    public function getWkKurikulumNamaLengkapAttribute(): ?string
    {
        return $this->namaLengkapPejabat('wk_kurikulum');
    }

    public function getKepalaSekolahNamaLengkapAttribute(): ?string
    {
        return $this->namaLengkapPejabat('kepala_sekolah');
    }

    private function namaLengkapPejabat(string $prefix): ?string
    {
        $nama = $this->{"{$prefix}_nama"};
        if (! $nama) return null;

        $full = $this->{"{$prefix}_gelar_depan"} ? $this->{"{$prefix}_gelar_depan"} . ' ' . $nama : $nama;

        return $this->{"{$prefix}_gelar_belakang"} ? $full . ', ' . $this->{"{$prefix}_gelar_belakang"} : $full;
    }

    public function classes(): HasMany
    {
        return $this->hasMany(SchoolClass::class);
    }

    public function ewsStatuses(): HasMany
    {
        return $this->hasMany(EwsStatus::class);
    }
}
