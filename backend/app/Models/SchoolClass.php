<?php

namespace App\Models;

use App\Enums\Tingkat;
use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SchoolClass extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $table = 'classes';

    protected $fillable = [
        'tingkat', 'jurusan', 'rombel', 'jadwal_pdf',
        'wali_kelas_id', 'academic_year_id',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'tingkat' => Tingkat::class,
        ];
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function waliKelas(): BelongsTo
    {
        return $this->belongsTo(User::class, 'wali_kelas_id');
    }

    public function students(): HasMany
    {
        return $this->hasMany(Student::class, 'class_id');
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(Schedule::class, 'class_id');
    }

    public function learningObjectives(): HasMany
    {
        return $this->hasMany(LearningObjective::class, 'class_id');
    }

    /**
     * Nama Program Keahlian (label lebih luas dari `jurusan`, yang sebenarnya
     * menyimpan nama Konsentrasi Keahlian). Dicocokkan longgar terhadap tabel
     * referensi `program_keahlians` yang diimpor dari sheet "Data Program
     * Keahlian" — null kalau belum ada data yang cocok.
     */
    public function programKeahlianNama(): ?string
    {
        $jurusan = mb_strtolower(trim($this->jurusan));
        if ($jurusan === '') return null;

        $match = ProgramKeahlian::get()->first(function ($pk) use ($jurusan) {
            $konsentrasi = mb_strtolower(trim($pk->konsentrasi));
            return $konsentrasi !== ''
                && (str_contains($konsentrasi, $jurusan) || str_contains($jurusan, $konsentrasi));
        });

        return $match?->program_keahlian;
    }

    /**
     * "Inisial Kelas" (kolom `kode` di program_keahlians, mis. "RPL"/"DKV") untuk jurusan
     * kelas ini — dipakai buat cocokkan nama file jadwal PDF masal (mis. "XII-RPL-A.pdf")
     * ke kelas yang tepat. Null kalau tidak ada Program Keahlian yang cocok.
     */
    public function programKeahlianKode(): ?string
    {
        $jurusan = mb_strtolower(trim($this->jurusan));
        if ($jurusan === '') return null;

        $match = ProgramKeahlian::get()->first(function ($pk) use ($jurusan) {
            $konsentrasi = mb_strtolower(trim($pk->konsentrasi));
            return $konsentrasi !== ''
                && (str_contains($konsentrasi, $jurusan) || str_contains($jurusan, $konsentrasi));
        });

        return $match?->kode;
    }
}
