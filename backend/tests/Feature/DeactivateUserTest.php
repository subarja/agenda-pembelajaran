<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Nonaktifkan guru/siswa (soft delete Teacher/Student + user nonaktif). Regresi bug
 * 2026-07-21: kode memakai UserStatus::NonAktif (case salah, tak ada) → PHP fatal error,
 * admin tak bisa menghapus/menonaktifkan guru maupun siswa.
 */
class DeactivateUserTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::create(['nama' => 'Admin', 'email' => 'admin@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Admin, 'must_change_password' => false]);
    }

    public function test_admin_bisa_menonaktifkan_guru(): void
    {
        Sanctum::actingAs($this->admin());

        $gu = User::create(['nama' => 'Guru X', 'email' => 'gurux@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Guru]);
        $teacher = Teacher::create(['user_id' => $gu->id, 'is_bk' => false]);

        $this->deleteJson("/api/v1/admin/teachers/{$teacher->uuid}")->assertOk();

        $this->assertSame(UserStatus::Nonaktif, $gu->fresh()->status);
        $this->assertSoftDeleted('teachers', ['id' => $teacher->id]);
    }

    public function test_admin_bisa_menonaktifkan_siswa(): void
    {
        Sanctum::actingAs($this->admin());

        $su = User::create(['nama' => 'Siswa X', 'email' => 'siswax@test.sch.id',
            'password' => 'secret123', 'role' => UserRole::Siswa]);
        $student = Student::create(['user_id' => $su->id, 'nis' => '9100']);

        $this->deleteJson("/api/v1/admin/students/{$student->uuid}")->assertOk();

        $this->assertSame(UserStatus::Nonaktif, $su->fresh()->status);
        $this->assertSoftDeleted('students', ['id' => $student->id]);
    }
}
