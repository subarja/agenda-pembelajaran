<?php

namespace App\Models;

use App\Enums\PklPlacementStatus;
use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Penempatan PKL satu siswa (tempat magang + rentang + guru pembimbing).
 */
class PklPlacement extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'student_id', 'class_id', 'academic_year_id', 'pembimbing_teacher_id',
        'tempat_pkl', 'alamat_pkl', 'telpon_siswa', 'tanggal_mulai', 'tanggal_selesai',
        'status', 'tanggal_berakhir_aktual', 'alasan_berakhir',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'tanggal_mulai' => 'date',
            'tanggal_selesai' => 'date',
            'tanggal_berakhir_aktual' => 'date',
            'status' => PklPlacementStatus::class,
        ];
    }

    /**
     * Tanggal efektif berakhirnya PKL = tanggal berhenti nyata bila ada
     * (mundur/pindah/selesai lebih awal), jika tidak pakai tanggal_selesai rencana.
     * Inilah batas kanan untuk semua tagihan (agenda/absen) & rekap.
     */
    public function tanggalEfektifBerakhir(): ?Carbon
    {
        return $this->tanggal_berakhir_aktual ?? $this->tanggal_selesai;
    }

    /**
     * Status yang DITAMPILKAN. Bila ditutup manual → status itu. Bila masih
     * "berlangsung" tapi tanggal efektif sudah lewat → otomatis dianggap "selesai"
     * (keputusan user: selesai sesuai tanggal = otomatis, tanpa perlu klik).
     */
    public function effectiveStatus(?string $today = null): PklPlacementStatus
    {
        if ($this->status && $this->status->isClosed()) {
            return $this->status;
        }
        $today ??= Carbon::now(config('app.school_timezone'))->toDateString();
        $akhir = $this->tanggalEfektifBerakhir()?->toDateString();
        if ($akhir && $today > $akhir) {
            return PklPlacementStatus::Selesai;
        }

        return PklPlacementStatus::Berlangsung;
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function pembimbing(): BelongsTo
    {
        return $this->belongsTo(Teacher::class, 'pembimbing_teacher_id');
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    /**
     * Normalisasi nomor HP ke bentuk 62… (digit saja) — sel Excel numerik menelan
     * nol di depan ('0812…' jadi 812…), jadi 8… dan 0… sama-sama diseragamkan.
     */
    public static function normalizeTelpon($raw): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $raw);
        if ($digits === '') {
            return null;
        }
        if (str_starts_with($digits, '620')) {
            // "+62 0812…" — nol sisipan setelah kode negara dibuang.
            return '62'.substr($digits, 3);
        }
        if (str_starts_with($digits, '0')) {
            return '62'.substr($digits, 1);
        }
        if (str_starts_with($digits, '8')) {
            return '62'.$digits;
        }

        return $digits;
    }

    /**
     * Periode bertumpuk dengan penempatan lain milik siswa yang sama pada TA sama?
     * Satu siswa boleh beberapa tempat PKL, tapi waktunya HARUS berbeda —
     * waktu bersamaan berarti ada kesalahan data.
     */
    public static function overlapExists(int $studentId, int $ayId, string $mulai, string $selesai, ?int $exceptId = null): bool
    {
        return self::where('student_id', $studentId)
            ->where('academic_year_id', $ayId)
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->whereDate('tanggal_mulai', '<=', $selesai)
            // Batas kanan pakai tanggal EFEKTIF berakhir: penempatan yang sudah
            // ditutup lebih awal (pindah/mundur) tidak boleh memblokir penempatan
            // baru yang mulai setelah tanggal berhentinya, walau tanggal_selesai
            // rencananya masih jauh ke depan.
            ->whereRaw('COALESCE(tanggal_berakhir_aktual, tanggal_selesai) >= ?', [$mulai])
            ->exists();
    }
}
