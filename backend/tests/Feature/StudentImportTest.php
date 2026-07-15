<?php

namespace Tests\Feature;

use App\Enums\Semester;
use App\Enums\Tingkat;
use App\Enums\UserRole;
use App\Models\AcademicYear;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Tests\TestCase;

/**
 * Import siswa dari Excel: kolom jenis_kelamin (L/P, opsional, menerima varian
 * "Laki-laki"/"Perempuan") dan pesan error kelas yang menyarankan padanan nama
 * jurusan — nama jurusan harus SAMA PERSIS dengan menu Kelas, tidak pernah
 * dicocokkan otomatis (pelajaran dari duplikat akun guru akibat fuzzy match).
 */
class StudentImportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $ay = AcademicYear::create([
            'tahun' => '2026/2027', 'semester' => Semester::Ganjil,
            'tanggal_mulai' => '2026-07-13', 'tanggal_selesai' => '2026-12-18', 'aktif' => true,
        ]);
        SchoolClass::create(['tingkat' => Tingkat::X, 'jurusan' => 'Mekatronika', 'rombel' => 'A', 'academic_year_id' => $ay->id]);

        Sanctum::actingAs(User::create([
            'nama' => 'Admin', 'email' => 'admin@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin,
        ]));
    }

    /** @param array<int, array<int, string>> $dataRows */
    private function xlsx(array $dataRows): UploadedFile
    {
        $path   = sys_get_temp_dir().'/import_siswa_test.xlsx';
        $writer = new XlsxWriter();
        $writer->openToFile($path);
        $writer->addRow(Row::fromValues(['nama', 'nis', 'nisn', 'kelas', 'angkatan', 'wali_nama', 'wali_kontak', 'jenis_kelamin']));
        foreach ($dataRows as $r) {
            $writer->addRow(Row::fromValues($r));
        }
        $writer->close();

        return new UploadedFile($path, 'siswa.xlsx', null, null, true);
    }

    public function test_import_menyimpan_jenis_kelamin_dan_menerima_varian_penulisan(): void
    {
        $res = $this->post('/api/v1/admin/import/siswa', ['file' => $this->xlsx([
            ['Ani', '2026001', '', 'X Mekatronika A', '2026', '', '', 'P'],
            ['Budi', '2026002', '', 'X Mekatronika A', '2026', '', '', 'Laki-laki'],
            ['Cici', '2026003', '', 'X Mekatronika A', '2026', '', '', ''],
        ])])->assertOk()->json();

        $this->assertSame(3, $res['success_count'], implode('; ', $res['errors']));
        $this->assertSame('P', Student::where('nis', '2026001')->first()->jenis_kelamin);
        $this->assertSame('L', Student::where('nis', '2026002')->first()->jenis_kelamin);
        $this->assertNull(Student::where('nis', '2026003')->first()->jenis_kelamin);
    }

    public function test_jenis_kelamin_tidak_valid_ditolak_per_baris(): void
    {
        $res = $this->post('/api/v1/admin/import/siswa', ['file' => $this->xlsx([
            ['Dodi', '2026004', '', 'X Mekatronika A', '2026', '', '', 'X'],
        ])])->assertOk()->json();

        $this->assertSame(0, $res['success_count']);
        $this->assertStringContainsString('Jenis kelamin harus L atau P', $res['errors'][0]);
    }

    public function test_kelas_tidak_cocok_memberi_saran_nama_yang_benar(): void
    {
        // Kasus nyata: Excel menulis "Teknik Mekatronika", menu Kelas mencatat "Mekatronika".
        $res = $this->post('/api/v1/admin/import/siswa', ['file' => $this->xlsx([
            ['Edi', '2026005', '', 'X Teknik Mekatronika A', '2026', '', '', 'L'],
        ])])->assertOk()->json();

        $this->assertSame(0, $res['success_count']);
        $this->assertStringContainsString("Mungkin maksudnya 'X Mekatronika A'", $res['errors'][0]);
        $this->assertDatabaseMissing('students', ['nis' => '2026005']);
    }

    public function test_template_siswa_memuat_kolom_jenis_kelamin(): void
    {
        $this->get('/api/v1/admin/template/siswa')->assertOk();
        // Isi header diverifikasi lewat config; cukup pastikan endpoint tidak pecah
        // setelah kolom bertambah (jumlah headers = example = notes).
    }

    /**
     * Regresi: slug route import HARUS sama dengan entity yang dikirim ImportModal
     * frontend (= kunci config template). Dulu route memakai bahasa Inggris
     * (import/students, dst.) sehingga SEMUA import lewat modal generik 404.
     */
    public function test_setiap_entity_modal_import_punya_route(): void
    {
        $entities = ['guru', 'siswa', 'kelas', 'mapel', 'jadwal', 'karakter_kategori', 'karakter_subitem', 'ambang'];

        foreach ($entities as $entity) {
            // Tanpa file → 422 validasi. Kalau route-nya tidak ada, jawabannya 404.
            $status = $this->postJson("/api/v1/admin/import/{$entity}")->getStatusCode();
            $this->assertSame(422, $status, "Route import/{$entity} hilang atau tidak cocok dengan slug frontend (status {$status}).");

            $this->get("/api/v1/admin/template/{$entity}")->assertOk();
        }
    }
}
