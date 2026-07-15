<?php

namespace App\Models;

use App\Traits\HasAuditTrail;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Student extends Model
{
    use HasAuditTrail, HasUuid, SoftDeletes;

    protected $fillable = [
        'user_id', 'nis', 'nisn', 'jenis_kelamin', 'class_id', 'angkatan',
        'status', 'tanggal_keluar',
        'nama_ayah', 'nama_ibu', 'hp_ortu',
        'wali_nama', 'wali_kontak', 'foto',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'angkatan'       => 'integer',
            'tanggal_keluar' => 'date',
        ];
    }

    /** Hanya siswa berstatus aktif — daftar operasional (bukan arsip alumni/pindahan). */
    public function scopeAktif(\Illuminate\Database\Eloquent\Builder $q): \Illuminate\Database\Eloquent\Builder
    {
        return $q->where('students.status', 'aktif');
    }

    /**
     * Riwayat keanggotaan kelas terekam otomatis di sini — jalur mana pun yang
     * memindahkan siswa (wizard naik kelas, impor Dapodik, edit admin) tidak bisa
     * lupa mencatat. Baris lama ditutup 'pindah' (status generik); PromotionController
     * menimpanya dengan 'naik'/'tinggal' yang lebih spesifik setelah update.
     */
    protected static function booted(): void
    {
        static::created(function (self $s) {
            if ($s->class_id !== null) {
                ClassEnrollment::firstOrCreate(
                    ['class_id' => $s->class_id, 'student_id' => $s->id],
                    ['status' => 'aktif'],
                );
            }
        });

        static::updated(function (self $s) {
            if (! $s->wasChanged('class_id')) {
                return;
            }

            $lama = $s->getOriginal('class_id');
            if ($lama !== null) {
                ClassEnrollment::where(['class_id' => $lama, 'student_id' => $s->id])
                    ->where('status', 'aktif')
                    ->update(['status' => 'pindah']);
            }

            if ($s->class_id !== null) {
                ClassEnrollment::updateOrCreate(
                    ['class_id' => $s->class_id, 'student_id' => $s->id],
                    ['status' => 'aktif'],
                );
            }
        });
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(ClassEnrollment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(StudentAttendance::class);
    }

    public function pklPlacements(): HasMany
    {
        return $this->hasMany(PklPlacement::class);
    }

    public function characterInputs(): HasMany
    {
        return $this->hasMany(CharacterInput::class);
    }

    public function recommendations(): HasMany
    {
        return $this->hasMany(Recommendation::class);
    }

    public function ewsStatus(): HasOne
    {
        return $this->hasOne(EwsStatus::class);
    }

    public function notes(): MorphMany
    {
        return $this->morphMany(Note::class, 'target');
    }
}
