<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class NotificationPreference extends Model
{
    /** Jenis notifikasi yang bisa dimatikan sendiri oleh pengguna. */
    public const TYPES = [
        'alpha_alert' => 'Peringatan alpha berturut-turut',
        'ews_escalation' => 'EWS siswa naik level',
        'rekomendasi' => 'Rekomendasi tindakan baru',
        'konseling_diajukan' => 'Pengajuan konseling ke BK',
        'catatan_manual' => 'Catatan manual karakter menunggu review',
        'inval_diajukan' => 'Permintaan mengajar sebagai guru pengganti',
        'inval_disetujui' => 'Permintaan inval Anda disetujui',
        'inval_ditolak' => 'Permintaan inval Anda ditolak',
        'inval_kedaluwarsa' => 'Permintaan inval kedaluwarsa tanpa jawaban',
        'izin_keluar_diajukan' => 'Pengajuan izin keluar siswa (piket)',
        'izin_keluar_scan' => 'Siswa terpindai keluar/masuk (piket)',
        'izin_kesiangan_diajukan' => 'Pengajuan izin kesiangan siswa (piket)',
    ];

    protected $fillable = [
        'user_id', 'push_enabled', 'types',
        'quiet_hours_enabled', 'quiet_start', 'quiet_end',
    ];

    protected $casts = [
        'push_enabled' => 'boolean',
        'quiet_hours_enabled' => 'boolean',
        'types' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Default WAJIB ditulis ulang di sini, tidak boleh mengandalkan default kolom DB.
     * firstOrCreate() menyimpan baris lalu mengembalikan model yang hanya berisi atribut
     * yang kita berikan — default DB terisi di tabel tapi TIDAK ikut terbaca ke objek,
     * sehingga `push_enabled` bernilai null dan cast boolean mengubahnya jadi false.
     * Akibatnya push mati diam-diam untuk setiap pengguna pada pemanggilan pertamanya.
     */
    public static function for(User $user): self
    {
        return static::firstOrCreate(['user_id' => $user->id], [
            'push_enabled' => true,
            'quiet_hours_enabled' => false,
            'quiet_start' => '21:00',
            'quiet_end' => '05:00',
        ]);
    }

    /**
     * Opt-OUT, bukan opt-in: jenis yang tidak tercantum di kolom `types` dianggap
     * menyala. Jadi jenis notifikasi baru di versi mendatang langsung aktif untuk
     * pengguna lama tanpa migrasi data.
     */
    public function allowsPush(string $type): bool
    {
        if (! $this->push_enabled) {
            return false;
        }

        return (bool) ($this->types[$type] ?? true);
    }

    /**
     * Rentang boleh melewati tengah malam (mis. 21:00–05:00), yang justru kasus
     * lazimnya. Kalau mulai == selesai, rentangnya nol — diperlakukan sebagai
     * "tidak ada jam tenang", bukan "tenang 24 jam" (menutup total push tanpa sengaja
     * jauh lebih buruk daripada tidak menahannya).
     */
    public function inQuietHours(?Carbon $now = null): bool
    {
        if (! $this->quiet_hours_enabled) {
            return false;
        }

        $start = $this->quiet_start ?: '21:00';
        $end = $this->quiet_end ?: '05:00';

        if ($start === $end) {
            return false;
        }

        // Jam tenang itu janji terhadap waktu TIDUR pengguna, jadi harus dievaluasi di
        // waktu lokal sekolah — bukan APP_TIMEZONE, yang di server produksi bisa saja
        // UTC dan akan menggeser "21:00" menjadi pukul 04:00 WIB.
        $current = ($now ?? now())->timezone(config('app.school_timezone'))->format('H:i');

        return $start < $end
            ? ($current >= $start && $current < $end)   // 01:00–05:00
            : ($current >= $start || $current < $end);  // 21:00–05:00 (lewat tengah malam)
    }
}
