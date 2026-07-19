<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Password default akun guru & siswa (Panel Admin > Pengguna).
 *
 * Sumber nilai berlapis: nilai di tabel ini MENANG atas config('accounts.*')
 * yang berasal dari .env server. .env tetap dipertahankan sebagai fallback agar
 * instalasi lama & seeder/test tidak perlu diubah, dan agar admin sekolah bisa
 * mengganti password default tanpa akses SSH ke server.
 */
class PasswordDefaultSetting extends Model
{
    protected $fillable = ['teacher_password', 'student_password'];

    protected $casts = [
        // Dienkripsi pakai APP_KEY — ini password plaintext yang dibagikan ke
        // ratusan akun, jadi tidak boleh terbaca langsung dari dump database.
        'teacher_password' => 'encrypted',
        'student_password' => 'encrypted',
    ];

    public static function instance(): self
    {
        return static::firstOrCreate([], []);
    }

    /**
     * Password default (plain) untuk sebuah tipe akun; null bila belum diatur
     * di panel admin MAUPUN di .env.
     *
     * @param  'guru'|'siswa'  $type
     */
    public static function resolve(string $type): ?string
    {
        $isSiswa = $type === 'siswa';
        $column = $isSiswa ? 'student_password' : 'teacher_password';

        return static::stored($column)
            ?: config($isSiswa ? 'accounts.default_student_password' : 'accounts.default_teacher_password');
    }

    /**
     * Sama seperti resolve(), tapi menghentikan request dengan 422 bila password
     * default belum diatur. Dipakai alur import massal: lebih baik gagal di awal
     * dengan pesan jelas daripada terlanjur membuat ratusan akun berpassword
     * asal-asalan yang tidak bisa dipakai login.
     *
     * @param  'guru'|'siswa'  $type
     */
    public static function resolveOrFail(string $type): string
    {
        $plain = static::resolve($type);

        abort_unless($plain, 422, 'Password default akun '.$type.' belum diatur. Isi lewat Panel Admin > Pengguna > Password Default (atau '
            .($type === 'siswa' ? 'DEFAULT_STUDENT_PASSWORD' : 'DEFAULT_TEACHER_PASSWORD').' di .env server) sebelum menjalankan import.');

        return $plain;
    }

    /**
     * Baca satu kolom rahasia TANPA melempar exception — kalau APP_KEY server
     * pernah berubah sejak nilai disimpan, DecryptException ditangkap di sini
     * dan pemanggil jatuh ke fallback .env (bukan seluruh app ikut down).
     */
    public static function stored(string $column): ?string
    {
        try {
            return static::instance()->{$column};
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }
}
