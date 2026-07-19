<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\PasswordDefaultSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Akun yang dibuat lewat import massal dulu memakai password 'password' yang
 * di-hardcode di controller — nilai yang sudah telanjur tercatat di riwayat git.
 * Sekarang wajib memakai password default terkonfigurasi (panel admin / .env)
 * dan akunnya ditandai must_change_password.
 */
class ImportDefaultPasswordTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        AcademicYear::create([
            'tahun' => '2026/2027', 'semester' => Semester::Ganjil,
            'tanggal_mulai' => '2026-07-15', 'tanggal_selesai' => '2026-12-04', 'aktif' => true,
        ]);

        $this->admin = User::create([
            'nama' => 'Admin Uji', 'email' => 'adminuji@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Admin,
        ]);

        Sanctum::actingAs($this->admin);
    }

    /**
     * File import dibuat dari endpoint template itu sendiri — formatnya dijamin
     * sinkron dengan yang dibaca importGuru(), dan baris contohnya (1 guru) sudah
     * cukup untuk membuktikan password apa yang dipakai.
     */
    private function templateGuru(): UploadedFile
    {
        // downloadTemplate() mengembalikan BinaryFileResponse — isinya dibaca dari
        // file sementaranya, bukan lewat streamedContent().
        $res = $this->get('/api/v1/admin/import/dapodik-guru/template')->assertOk();
        $path = tempnam(sys_get_temp_dir(), 'tpl_test_').'.xlsx';
        copy($res->baseResponse->getFile()->getPathname(), $path);

        return new UploadedFile($path, 'Format Import Data Guru.xlsx', null, null, true);
    }

    public function test_import_guru_ditolak_bila_password_default_belum_diatur(): void
    {
        config(['accounts.default_teacher_password' => null]);

        $res = $this->postJson('/api/v1/admin/import/dapodik-guru', ['file' => $this->templateGuru()]);

        $res->assertStatus(422);
        $this->assertStringContainsString('Password default', $res->json('message'));
        // Gagal di awal — tidak ada akun setengah jadi yang tertinggal.
        $this->assertSame(0, User::where('role', UserRole::Guru)->count());
    }

    public function test_import_guru_memakai_password_default_dan_menandai_wajib_ganti(): void
    {
        config(['accounts.default_teacher_password' => 'DariEnv#2026']);
        PasswordDefaultSetting::instance()->update(['teacher_password' => 'DariPanel#2026']);

        $this->post('/api/v1/admin/import/dapodik-guru', ['file' => $this->templateGuru()])->assertOk();

        $guru = User::where('role', UserRole::Guru)->firstOrFail();
        $this->assertTrue(Hash::check('DariPanel#2026', $guru->password), 'password panel admin dipakai');
        $this->assertFalse(Hash::check('password', $guru->password), 'password hardcoded lama tidak dipakai lagi');
        $this->assertTrue($guru->must_change_password);
    }
}
