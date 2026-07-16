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

    /** Cache per-request: jurusan (lower) → ProgramKeahlian|null, hindari query berulang. */
    protected static array $pkMatchCache = [];

    /**
     * Cari Program Keahlian yang konsentrasinya cocok longgar dengan sebuah
     * nama jurusan (kolom `jurusan` kelas menyimpan nama Konsentrasi Keahlian).
     */
    public static function programKeahlianFor(?string $jurusan): ?ProgramKeahlian
    {
        $key = mb_strtolower(trim((string) $jurusan));
        if ($key === '') return null;

        if (! array_key_exists($key, static::$pkMatchCache)) {
            static::$pkMatchCache[$key] = ProgramKeahlian::get()->first(function ($pk) use ($key) {
                $konsentrasi = mb_strtolower(trim($pk->konsentrasi));
                return $konsentrasi !== ''
                    && (str_contains($konsentrasi, $key) || str_contains($key, $konsentrasi));
            });
        }

        return static::$pkMatchCache[$key];
    }

    /**
     * Nama Program Keahlian (label lebih luas dari `jurusan`, yang sebenarnya
     * menyimpan nama Konsentrasi Keahlian). Dicocokkan longgar terhadap tabel
     * referensi `program_keahlians` yang diimpor dari sheet "Data Program
     * Keahlian" — null kalau belum ada data yang cocok.
     */
    public function programKeahlianNama(): ?string
    {
        return static::programKeahlianFor($this->jurusan)?->program_keahlian;
    }

    /**
     * "Inisial Kelas" (kolom `kode` di program_keahlians, mis. "RPL"/"DKV") untuk jurusan
     * kelas ini — dipakai buat cocokkan nama file jadwal PDF masal (mis. "XII-RPL-A.pdf")
     * ke kelas yang tepat. Null kalau tidak ada Program Keahlian yang cocok.
     */
    public function programKeahlianKode(): ?string
    {
        return static::programKeahlianFor($this->jurusan)?->kode;
    }

    /**
     * Kode jurusan untuk label kelas: kode Program Keahlian (mis. "RPL", "MEKA",
     * "ANIMASI") — fallback ke nama jurusan apa adanya bila referensi belum ada.
     */
    public function jurusanKode(): string
    {
        return $this->programKeahlianKode() ?? $this->jurusan;
    }

    /**
     * Nama baku kelas untuk SEMUA tampilan & dokumen: "{tingkat} {KODE} {rombel}",
     * mis. "XII RPL A". Jangan merangkai tingkat+jurusan+rombel manual di tempat lain.
     */
    public function label(): string
    {
        return trim("{$this->tingkat->value} {$this->jurusanKode()} {$this->rombel}");
    }

    /**
     * Cari kelas berdasarkan potongan nama bakunya ("XII RPL A") — nama jurusan
     * lengkap format lama ("XII Rekayasa Perangkat Lunak - A") tetap diterima.
     * Kode jurusan datang dari tabel referensi dengan pencocokan longgar, jadi
     * tidak bisa dirangkai di SQL — kandidat dicocokkan di PHP lalu di-whereIn.
     */
    public function scopeWhereLabelLike($query, string $term): void
    {
        $term = mb_strtolower(trim($term));

        $ids = static::query()->get(['id', 'tingkat', 'jurusan', 'rombel'])
            ->filter(fn ($c) => str_contains(mb_strtolower($c->label()), $term)
                || str_contains(mb_strtolower("{$c->tingkat->value} {$c->jurusan} - {$c->rombel}"), $term))
            ->pluck('id');

        $query->whereIn($this->getTable().'.id', $ids);
    }
}
