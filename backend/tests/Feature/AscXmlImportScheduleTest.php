<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\Schedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Regresi import jadwal aSc XML:
 *  1. Lesson ber-BEBERAPA guru (team teaching) harus menghasilkan satu baris jadwal
 *     per guru — dulu lookup slot tanpa teacher_id membuat guru terakhir menimpa
 *     guru sebelumnya, sehingga beban mengajar rekannya hilang (kasus nyata: beban
 *     mengajar kelas XII tidak semua muncul).
 *  2. Bitmask hari multi-hari ('11000' = Senin+Selasa) harus terurai per hari —
 *     dulu hanya one-hot 5 hari yang dikenali, sisanya di-skip diam-diam.
 *  3. Re-import file yang sama idempotent (tidak menggandakan baris).
 */
class AscXmlImportScheduleTest extends TestCase
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

        $this->admin = User::create(['nama' => 'Admin Import', 'email' => 'adminimport@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin]);
    }

    private function xmlFile(): UploadedFile
    {
        $xml = <<<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<timetable>
  <periods>
    <period period="1" starttime="07:00" endtime="07:45"/>
    <period period="2" starttime="07:45" endtime="08:30"/>
  </periods>
  <subjects>
    <subject id="S1" name="KK Animasi 12" short="KKA"/>
  </subjects>
  <teachers>
    <teacher id="T1" name="Budi Hartono Nugraha" short="KKA-Budi"/>
    <teacher id="T2" name="Rina Marlina Kusuma" short="KKA-Rina"/>
  </teachers>
  <classes>
    <class id="C1" name="XII-ANM-A"/>
  </classes>
  <lessons>
    <lesson id="L1" classids="C1" subjectid="S1" teacherids="T1,T2" periodsperweek="4"/>
  </lessons>
  <cards>
    <card lessonid="L1" days="11000" period="1"/>
    <card lessonid="L1" days="11000" period="2"/>
  </cards>
</timetable>
XML;

        return UploadedFile::fake()->createWithContent('jadwal.xml', $xml);
    }

    public function test_lesson_multi_guru_dan_kartu_multi_hari_menghasilkan_baris_per_guru_per_hari(): void
    {
        Sanctum::actingAs($this->admin);

        $res = $this->post('/api/v1/admin/import/asc-xml', ['file' => $this->xmlFile()])->assertOk();

        // 2 hari (senin+selasa) × 2 guru = 4 baris jadwal.
        $this->assertSame(4, $res->json('data.jadwal.created'));
        $this->assertSame(4, Schedule::count());
        $this->assertSame(2, Schedule::distinct('teacher_id')->count('teacher_id'));
        $this->assertEqualsCanonicalizing(
            ['senin', 'selasa'],
            Schedule::distinct()->pluck('hari')->map(fn ($h) => $h->value)->all(),
        );

        // Kedua kartu (jam ke-1 & ke-2) menyatu jadi satu blok 07:00–08:30 per baris.
        $this->assertSame(0, Schedule::where('jam_ke_mulai', 1)->where('jam_ke_selesai', 2)->count() - 4);
    }

    public function test_reimport_file_sama_idempotent(): void
    {
        Sanctum::actingAs($this->admin);

        $this->post('/api/v1/admin/import/asc-xml', ['file' => $this->xmlFile()])->assertOk();
        $res = $this->post('/api/v1/admin/import/asc-xml', ['file' => $this->xmlFile()])->assertOk();

        $this->assertSame(0, $res->json('data.jadwal.created'));
        $this->assertSame(4, $res->json('data.jadwal.updated'));
        $this->assertSame(4, Schedule::count());
    }
}
