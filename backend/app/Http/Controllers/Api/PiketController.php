<?php

namespace App\Http\Controllers\Api;

use App\Enums\AttendanceStatus;
use App\Enums\IzinKeluarStatus;
use App\Enums\IzinKesianganStatus;
use App\Http\Controllers\Controller;
use App\Models\Agenda;
use App\Models\DailyAttendance;
use App\Models\IzinKeluar;
use App\Models\IzinKesiangan;
use App\Models\PiketResume;
use App\Models\PiketShift;
use App\Models\PrintSetting;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Teacher;
use App\Services\KesianganService;
use App\Support\BellRingPlan;
use App\Support\BellSchedule;
use App\Support\KokurikulerMode;
use App\Support\PiketAccess;
use App\Support\PklMode;
use App\Support\SemesterLock;
use App\Support\SessionTeacher;
use App\Support\TahunAjaran;
use App\Traits\BuildsXlsxReports;
use App\Traits\HandlesPdfPreview;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use OpenSpout\Common\Entity\Cell\StringCell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;

/**
 * Dashboard Piket (guru piket hari itu). Bel real-time + petugas (S3), izin keluar QR (S4),
 * kesiangan (S5), absensi harian + resume piket (S6). Semua endpoint diproteksi PiketAccess.
 */
class PiketController extends Controller
{
    use BuildsXlsxReports, HandlesPdfPreview;

    // ── GET /piket/ringkasan ─────────────────────────────────────────────────
    public function ringkasan(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $now = Carbon::now('Asia/Jakarta');
        $jamNow = $now->format('H:i:s');
        $shiftModels = $this->shiftsHariIni($tanggal);

        $shifts = $shiftModels->map(fn ($s) => [
            'nama_shift' => $s->nama_shift,
            'jam_mulai' => Carbon::parse($s->jam_mulai)->format('H:i'),
            'jam_selesai' => Carbon::parse($s->jam_selesai)->format('H:i'),
            'petugas' => $s->teachers->map(fn ($t) => $t->user?->nama)->filter()->values(),
            'aktif_sekarang' => Carbon::parse($s->jam_mulai)->format('H:i:s') <= $jamNow
                && $jamNow < Carbon::parse($s->jam_selesai)->format('H:i:s'),
        ])->values();

        $petugas = $shiftModels
            ->flatMap(fn ($s) => $s->teachers->map(fn ($t) => $t->user?->nama))
            ->filter()->unique()->values();

        return response()->json(['data' => [
            'tanggal' => $tanggal,
            'server_time' => $now->format('H:i:s'),
            'petugas' => $petugas,
            'shifts' => $shifts,
            'events' => BellRingPlan::forDate($tanggal),
        ]]);
    }

    // ── GET /piket/pantau — pantau jadwal harian + status agenda/presensi ────
    public function pantau(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $iso = Carbon::parse($tanggal)->dayOfWeekIso;   // 1=Senin .. 7=Minggu
        $hari = [1 => 'senin', 2 => 'selasa', 3 => 'rabu', 4 => 'kamis', 5 => 'jumat', 6 => 'sabtu'][$iso] ?? null;

        $sesi = collect();
        if ($hari) {
            $schedules = Schedule::tahunAjaran()
                ->where('hari', $hari)
                ->where('aktif', true)
                ->with(['subject', 'schoolClass', 'teacher.user'])
                ->get()
                // Kelas yang hari ini PKL/Kokurikuler tidak wajib agenda reguler → jangan
                // ditandai "belum isi agenda" yang menyesatkan.
                ->reject(fn ($s) => PklMode::isAgendaExempt($s->class_id, $tanggal) || KokurikulerMode::isAgendaExempt($s->class_id, $tanggal))
                ->sortBy(fn ($s) => BellSchedule::resolve($s, $tanggal)['jam_mulai'])
                ->values();

            $scheduleIds = $schedules->pluck('id')->all();

            $agendas = Agenda::whereIn('schedule_id', $scheduleIds)
                ->whereDate('tanggal', $tanggal)
                ->with('studentAttendances.student.user')
                ->get()->keyBy('schedule_id');

            $rosterCount = Student::whereIn('class_id', $schedules->pluck('class_id')->unique()->all())
                ->selectRaw('class_id, count(*) as c')->groupBy('class_id')->pluck('c', 'class_id');

            // Guru efektif (memperhitungkan inval/pengganti yang disetujui) — batch, anti N+1.
            $overrides = SessionTeacher::overridesForDate($scheduleIds, $tanggal);
            $effTeacherIds = [];
            foreach ($schedules as $s) {
                $effTeacherIds[$s->id] = $overrides[$s->id] ?? $s->teacher_id;
            }
            $teacherNames = Teacher::with('user')->whereIn('id', array_values(array_unique($effTeacherIds)))
                ->get()->mapWithKeys(fn ($t) => [$t->id => $t->user?->nama]);

            $sesi = $schedules->map(function ($s) use ($tanggal, $agendas, $rosterCount, $effTeacherIds, $teacherNames) {
                $jam = BellSchedule::resolve($s, $tanggal);
                $agenda = $agendas->get($s->id);
                $eff = $effTeacherIds[$s->id];
                $isInval = $eff !== $s->teacher_id;

                $att = $agenda?->studentAttendances ?? collect();
                $presensiTerisi = $att->isNotEmpty();
                $tidakHadir = $att
                    ->filter(fn ($a) => $a->status !== AttendanceStatus::Hadir)
                    ->map(fn ($a) => [
                        'nama' => $a->student?->user?->nama,
                        'status' => $a->status->value,
                        'alasan' => $a->catatan,
                        'terlambat_menit' => $a->durasi_terlambat,
                    ])->values();

                return [
                    'id' => $s->uuid,
                    'jam_ke' => $s->jam_ke_selesai && $s->jam_ke_selesai !== $s->jam_ke_mulai
                        ? "{$s->jam_ke_mulai}–{$s->jam_ke_selesai}"
                        : (string) $s->jam_ke_mulai,
                    'jam_mulai' => substr($jam['jam_mulai'], 0, 5),
                    'jam_selesai' => substr($jam['jam_selesai'], 0, 5),
                    'kelas' => $s->schoolClass?->label(),
                    'mapel' => PklMode::subjectLabelFor($s),
                    'ruangan' => $s->ruangan,
                    'guru' => $teacherNames[$eff] ?? '—',
                    'guru_terjadwal' => $isInval ? $s->teacher?->user?->nama : null,
                    'is_inval' => $isInval,
                    'agenda_status' => $agenda ? $agenda->status->value : 'kosong',
                    'presensi_terisi' => $presensiTerisi,
                    'hadir' => $presensiTerisi ? $att->filter(fn ($a) => $a->status === AttendanceStatus::Hadir)->count() : null,
                    'total' => $presensiTerisi ? $att->count() : ($rosterCount[$s->class_id] ?? null),
                    'tidak_hadir' => $tidakHadir,
                ];
            })->values();
        }

        $kesiangan = IzinKesiangan::tahunAjaran()
            ->with('student.user', 'student.schoolClass')
            ->where('tanggal', $tanggal)
            ->orderByDesc('id')->get()
            ->map(fn ($i) => [
                'nama' => $i->student?->user?->nama,
                'kelas' => $i->student?->schoolClass?->label(),
                'waktu_tiba' => $i->waktu_tiba?->format('H:i'),
                'terlambat_menit' => $i->terlambat_menit,
                'alasan' => $i->alasan,
                'status_label' => $i->status->label(),
            ]);

        return response()->json(['data' => [
            'tanggal' => $tanggal,
            'server_time' => Carbon::now('Asia/Jakarta')->format('H:i:s'),
            'sesi' => $sesi,
            'kesiangan' => $kesiangan,
            'ringkasan' => [
                'total_sesi' => $sesi->count(),
                'agenda_terisi' => $sesi->where('agenda_status', 'submitted')->count(),
                'agenda_kosong' => $sesi->where('agenda_status', 'kosong')->count(),
                'presensi_terisi' => $sesi->where('presensi_terisi', true)->count(),
                'kesiangan_count' => $kesiangan->count(),
            ],
        ]]);
    }

    // ── GET /piket/izin-keluar — pengajuan + status hari ini ─────────────────
    public function izinKeluar(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $daftar = IzinKeluar::tahunAjaran()
            ->with('student.user', 'student.schoolClass')
            ->where('tanggal', $tanggal)
            ->orderByDesc('id')
            ->get()
            ->map(fn ($i) => $this->presentIzin($i));

        return response()->json(['data' => $daftar]);
    }

    // ── POST /piket/izin-keluar/{uuid}/proses — setujui/tolak/batalkan ───────
    public function prosesIzinKeluar(Request $request, string $uuid): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $data = $request->validate([
            'aksi' => ['required', Rule::in(['setujui', 'tolak', 'batalkan'])],
            'berlaku_sampai' => ['required_if:aksi,setujui', 'nullable', 'date_format:H:i'],
            'berlaku_dari' => ['nullable', 'date_format:H:i'],
            'catatan_piket' => ['nullable', 'string', 'max:255'],
        ]);

        $izin = IzinKeluar::tahunAjaran()->where('uuid', $uuid)->firstOrFail();
        $teacherId = $request->user()->teacher?->id;

        if ($data['aksi'] === 'setujui') {
            abort_unless($izin->status === IzinKeluarStatus::Diajukan, 422, 'Izin ini tidak dalam status menunggu.');

            $hari = Carbon::now('Asia/Jakarta');
            $dari = $data['berlaku_dari'] ?? $hari->format('H:i');

            $izin->fill([
                'status' => IzinKeluarStatus::Disetujui,
                'diproses_oleh' => $teacherId,
                'berlaku_dari' => Carbon::parse($tanggal.' '.$dari, 'Asia/Jakarta'),
                'berlaku_sampai' => Carbon::parse($tanggal.' '.$data['berlaku_sampai'], 'Asia/Jakarta'),
                'catatan_piket' => $data['catatan_piket'] ?? null,
            ]);
            $izin->qr_token = $izin->generateQrToken();
            $izin->save();

            return response()->json(['message' => 'Izin disetujui. QR muncul di akun siswa.']);
        }

        if ($data['aksi'] === 'tolak') {
            abort_unless($izin->status === IzinKeluarStatus::Diajukan, 422, 'Izin ini tidak dalam status menunggu.');
            $izin->update(['status' => IzinKeluarStatus::Ditolak, 'diproses_oleh' => $teacherId, 'catatan_piket' => $data['catatan_piket'] ?? null]);

            return response()->json(['message' => 'Izin ditolak.']);
        }

        // batalkan (sebelum keluar)
        abort_unless(in_array($izin->status, [IzinKeluarStatus::Diajukan, IzinKeluarStatus::Disetujui], true), 422, 'Izin ini tidak bisa dibatalkan.');
        $izin->update(['status' => IzinKeluarStatus::Dibatalkan, 'qr_token' => null, 'catatan_piket' => $data['catatan_piket'] ?? null]);

        return response()->json(['message' => 'Izin dibatalkan.']);
    }

    // ── GET /piket/izin-keluar/log — keluar/masuk real-time hari ini ─────────
    public function izinKeluarLog(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $log = IzinKeluar::tahunAjaran()
            ->with('student.user', 'scanKeluar', 'scanMasuk')
            ->where('tanggal', $tanggal)
            ->whereNotNull('waktu_keluar')
            ->orderByDesc('waktu_keluar')
            ->get()
            ->map(fn ($i) => [
                'id' => $i->uuid,
                'nama' => $i->student?->user?->nama,
                'keperluan' => $i->keperluan,
                'status' => $i->status->value,
                'status_label' => $i->status->label(),
                'waktu_keluar' => $i->waktu_keluar?->format('H:i'),
                'scan_keluar' => $i->scanKeluar?->nama,
                'waktu_masuk' => $i->waktu_masuk?->format('H:i'),
                'scan_masuk' => $i->scanMasuk?->nama,
            ]);

        return response()->json(['data' => $log]);
    }

    // ── GET /piket/kesiangan — verifikasi kesiangan hari ini (foto tampil) ───
    public function kesiangan(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $daftar = IzinKesiangan::tahunAjaran()
            ->with('student.user', 'student.schoolClass')
            ->where('tanggal', $tanggal)
            ->orderByDesc('id')
            ->get()
            ->map(fn ($i) => [
                'id' => $i->uuid,
                'nama' => $i->student?->user?->nama,
                'kelas' => $i->student?->schoolClass?->label(),
                'foto_url' => $i->student?->foto ? Storage::disk('public')->url($i->student->foto) : null,
                'alasan' => $i->alasan,
                'waktu_tiba' => $i->waktu_tiba?->format('H:i'),
                'terlambat_menit' => $i->terlambat_menit,
                'status' => $i->status->value,
                'status_label' => $i->status->label(),
            ]);

        return response()->json(['data' => $daftar]);
    }

    // ── POST /piket/kesiangan/{uuid}/verifikasi — setujui/tolak (+ poin otomatis) ──
    public function verifikasiKesiangan(Request $request, string $uuid): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $data = $request->validate(['aksi' => ['required', Rule::in(['setujui', 'tolak'])]]);
        $izin = IzinKesiangan::tahunAjaran()->where('uuid', $uuid)->firstOrFail();

        $izin->update([
            'status' => $data['aksi'] === 'setujui' ? IzinKesianganStatus::Disetujui : IzinKesianganStatus::Ditolak,
            'diverifikasi_oleh' => $request->user()->teacher?->id,
        ]);

        // Poin negatif otomatis dikenakan baik disetujui maupun ditolak (keputusan user).
        app(KesianganService::class)->terapkanPoin($izin->fresh());

        return response()->json(['message' => 'Kesiangan diverifikasi. Poin keterlambatan tercatat otomatis.']);
    }

    // ── GET /piket/resume — resume gabungan hari ini ─────────────────────────
    public function resume(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $resume = PiketResume::tahunAjaran()->where('tanggal', $tanggal)->with('teacher.user')->first();

        return response()->json(['data' => [
            'tanggal' => $tanggal,
            'ringkasan' => $resume?->ringkasan,
            'kejadian_penting' => $resume?->kejadian_penting,
            'penyunting' => $resume?->teacher?->user?->nama,
            'diperbarui' => $resume?->updated_at?->toIso8601String(),
        ]]);
    }

    // ── POST /piket/resume — simpan resume gabungan (upsert per tanggal) ─────
    public function simpanResume(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $data = $request->validate([
            'ringkasan' => ['required', 'string', 'max:5000'],
            'kejadian_penting' => ['nullable', 'string', 'max:5000'],
        ]);

        PiketResume::updateOrCreate(
            ['tanggal' => $tanggal],
            [
                'ringkasan' => $data['ringkasan'],
                'kejadian_penting' => $data['kejadian_penting'] ?? null,
                'teacher_id' => $request->user()->teacher?->id,
            ],
        );

        return response()->json(['message' => 'Resume piket disimpan.']);
    }

    // ── GET /piket/absensi?class_id= — roster + status harian satu kelas ─────
    public function absensi(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $request->validate(['class_id' => ['required', 'string']]);
        $kelas = $this->resolveKelas($request->input('class_id'));
        abort_if(! $kelas, 404, 'Kelas tidak ditemukan.');

        $students = Student::where('class_id', $kelas->id)->with('user:id,nama')->get()->sortBy(fn ($s) => $s->user->nama)->values();
        $existing = DailyAttendance::where('class_id', $kelas->id)->where('tanggal', $tanggal)->get()->keyBy('student_id');

        return response()->json(['data' => [
            'tanggal' => $tanggal,
            'kelas' => ['id' => $kelas->uuid, 'label' => $kelas->label()],
            'is_filled' => $existing->isNotEmpty(),
            'records' => $students->map(fn ($s) => [
                'student_id' => $s->uuid,
                'nama' => $s->user->nama,
                'nis' => $s->nis,
                'status' => $existing[$s->id]?->status ?? 'hadir',
                'catatan' => $existing[$s->id]?->catatan ?? null,
                'sudah_diisi' => $existing->has($s->id),
            ]),
        ]]);
    }

    // ── POST /piket/absensi — simpan absensi harian (recorded_by = piket) ────
    public function simpanAbsensi(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $data = $request->validate([
            'class_id' => ['required', 'string'],
            'records' => ['required', 'array', 'min:1'],
            'records.*.student_id' => ['required', 'string'],
            'records.*.status' => ['required', Rule::in(['hadir', 'sakit', 'izin', 'alpha'])],
            'records.*.catatan' => ['nullable', 'string', 'max:500'],
        ]);

        $kelas = $this->resolveKelas($data['class_id']);
        abort_if(! $kelas, 404, 'Kelas tidak ditemukan.');
        SemesterLock::assertClassWritable($kelas->id);

        $map = Student::where('class_id', $kelas->id)->pluck('id', 'uuid');
        $userId = $request->user()->id;

        DB::transaction(function () use ($data, $kelas, $map, $tanggal, $userId) {
            foreach ($data['records'] as $rec) {
                $sid = $map[$rec['student_id']] ?? null;
                if (! $sid) {
                    continue;
                }
                DailyAttendance::updateOrCreate(
                    ['student_id' => $sid, 'tanggal' => $tanggal],
                    ['class_id' => $kelas->id, 'status' => $rec['status'], 'catatan' => $rec['catatan'] ?? null, 'recorded_by' => $userId],
                );
            }
        });

        return response()->json(['message' => 'Absensi harian disimpan.']);
    }

    // ── GET /piket/resume/export?format=pdf|xlsx ─────────────────────────────
    public function exportResume(Request $request)
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);
        $request->validate(['format' => ['required', Rule::in(['pdf', 'xlsx'])]]);

        $resume = PiketResume::tahunAjaran()->where('tanggal', $tanggal)->first();
        $petugas = $this->shiftsHariIni($tanggal)
            ->flatMap(fn ($s) => $s->teachers->map(fn ($t) => $t->user?->nama))
            ->filter()->unique()->values();
        $tglLabel = Carbon::parse($tanggal)->locale('id')->isoFormat('dddd, D MMMM YYYY');
        $filename = 'Resume_Piket_'.$tanggal;

        if ($request->format === 'xlsx') {
            return $this->exportResumeXlsx($filename, $tglLabel, $petugas->all(), $resume);
        }

        $printSettings = PrintSetting::instance($request->user()->id);
        $pdf = Pdf::loadView('reports.resume_piket', [
            'tanggalLabel' => $tglLabel,
            'petugas' => $petugas->all(),
            'ringkasan' => $resume?->ringkasan ?? '(belum diisi)',
            'kejadianPenting' => $resume?->kejadian_penting,
            'kopSuratPath' => 'file://'.public_path('images/kop_surat.jpg'),
            'printSettings' => $printSettings,
            'tanggalTtd' => Carbon::parse($tanggal)->locale('id')->isoFormat('D MMMM YYYY'),
        ])->setPaper($printSettings->paperDimensionsPt(), 'portrait');

        return $this->pdfResponse($pdf, "{$filename}.pdf", $request);
    }

    private function exportResumeXlsx(string $filename, string $tglLabel, array $petugas, ?PiketResume $resume)
    {
        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use ($tglLabel, $petugas, $resume) {
            $this->xlsxSetColumnWidths($w, [1 => 5, 2 => 22, 3 => 70]);
            $label = $this->xlsxLabelStyle();

            $w->addRow(Row::fromValuesWithStyle(['RESUME PIKET HARIAN'], $this->xlsxTitleStyle()));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(new Row([new StringCell(''), new StringCell('Tanggal', $label), new StringCell(": {$tglLabel}")]));
            $w->addRow(new Row([new StringCell(''), new StringCell('Petugas Piket', $label), new StringCell(': '.(empty($petugas) ? '-' : implode(', ', $petugas)))]));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(new Row([new StringCell(''), new StringCell('Ringkasan', $label), new StringCell(': '.($resume?->ringkasan ?? '-'), $this->xlsxCellStyle())]));
            $w->addRow(new Row([new StringCell(''), new StringCell('Kejadian Penting', $label), new StringCell(': '.($resume?->kejadian_penting ?? '-'), $this->xlsxCellStyle())]));
        });
    }

    /** Kelas mana pun di TA aktif (piket bertugas lintas kelas), diresolve dari uuid. */
    private function resolveKelas(?string $uuid): ?SchoolClass
    {
        if (! $uuid) {
            return null;
        }

        return SchoolClass::where('academic_year_id', TahunAjaran::id())->where('uuid', $uuid)->first();
    }

    private function presentIzin(IzinKeluar $i): array
    {
        return [
            'id' => $i->uuid,
            'nama' => $i->student?->user?->nama,
            'kelas' => $i->student?->schoolClass?->label(),
            'foto_url' => $i->student?->foto ? Storage::disk('public')->url($i->student->foto) : null,
            'keperluan' => $i->keperluan,
            'alasan' => $i->alasan,
            'status' => $i->status->value,
            'status_label' => $i->status->label(),
            'berlaku_dari' => $i->berlaku_dari?->format('H:i'),
            'berlaku_sampai' => $i->berlaku_sampai?->format('H:i'),
            'waktu_keluar' => $i->waktu_keluar?->format('H:i'),
            'waktu_masuk' => $i->waktu_masuk?->format('H:i'),
            'catatan_piket' => $i->catatan_piket,
        ];
    }

    /** Abort 403 bila user bukan petugas piket pada tanggal itu. */
    private function pastikanPetugas(Request $request, string $tanggal): void
    {
        abort_unless(PiketAccess::isPetugas($request->user(), $tanggal), 403, 'Anda tidak bertugas piket hari ini.');
    }

    /** Shift piket pada hari-dalam-seminggu dari tanggal (dengan petugas). Kosong bila Sabtu/Minggu. */
    private function shiftsHariIni(string $tanggal): Collection
    {
        $iso = Carbon::parse($tanggal)->dayOfWeekIso;   // 1=Senin .. 7=Minggu
        $hari = [1 => 'senin', 2 => 'selasa', 3 => 'rabu', 4 => 'kamis', 5 => 'jumat', 6 => 'sabtu'][$iso] ?? null;
        if (! $hari) {
            return collect();
        }

        return PiketShift::tahunAjaran()
            ->where('hari', $hari)
            ->with('teachers.user')
            ->orderBy('urutan')
            ->orderBy('jam_mulai')
            ->get();
    }
}
