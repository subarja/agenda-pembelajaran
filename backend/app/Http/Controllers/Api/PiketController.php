<?php

namespace App\Http\Controllers\Api;

use App\Enums\AgendaStatus;
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
use App\Models\User;
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
use OpenSpout\Common\Entity\Style\CellAlignment;
use OpenSpout\Common\Entity\Style\Style;
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

        $schedules = $this->jadwalHariIni($tanggal);

        $sesi = collect();
        if ($schedules->isNotEmpty()) {
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

    // ── GET /piket/izin-keluar — pengajuan hari ini + yang belum kembali (lintas hari) ─
    public function izinKeluar(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $rel = ['student.user', 'student.schoolClass', 'kembaliManualOleh.user'];

        $daftar = IzinKeluar::tahunAjaran()
            ->with($rel)
            ->where('tanggal', $tanggal)
            ->orderByDesc('id')
            ->get()
            ->map(fn ($i) => $this->presentIzin($i));

        // Lintas hari: siswa yang masih "keluar" dari hari-hari SEBELUMNYA (belum dinyatakan
        // kembali) — bisa divalidasi manual oleh petugas piket hari ini.
        $belumKembaliLampau = IzinKeluar::tahunAjaran()
            ->with($rel)
            ->where('status', IzinKeluarStatus::Keluar)
            ->whereDate('tanggal', '<', $tanggal)
            ->orderBy('tanggal')
            ->get()
            ->map(fn ($i) => $this->presentIzin($i));

        return response()->json(['data' => $daftar, 'belum_kembali_lampau' => $belumKembaliLampau]);
    }

    // ── POST /piket/izin-keluar/{uuid}/tandai-kembali — validasi manual oleh piket ──
    public function tandaiKembali(Request $request, string $uuid): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);   // pemvalidasi wajib petugas piket hari ini

        $data = $request->validate(['keterangan' => ['required', 'string', 'max:500']]);

        // Tanpa filter tanggal → lintas hari. Hanya izin yang masih "keluar" yang bisa ditandai kembali.
        $izin = IzinKeluar::tahunAjaran()->where('uuid', $uuid)->firstOrFail();
        abort_unless($izin->status === IzinKeluarStatus::Keluar, 422, 'Izin ini tidak berstatus "sedang di luar" (mungkin sudah kembali atau dibatalkan).');

        $izin->update([
            'status' => IzinKeluarStatus::Kembali,
            'waktu_masuk' => Carbon::now('Asia/Jakarta'),
            'kembali_manual_oleh' => $request->user()->teacher?->id,
            'catatan_kembali' => $data['keterangan'],
        ]);

        return response()->json(['message' => 'Siswa dinyatakan sudah kembali (dikonfirmasi piket).']);
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
        $status = app(KesianganService::class)->terapkanPoin($izin->fresh());

        $pesan = match ($status) {
            'applied' => 'Kesiangan diverifikasi. Poin keterlambatan tercatat otomatis.',
            'not_configured' => 'Kesiangan diverifikasi, TAPI poin belum tercatat — sub-karakter kesiangan belum dipilih. Atur di Panel Admin › Piket › Poin Kesiangan Otomatis.',
            'no_tier' => 'Kesiangan diverifikasi. Poin tidak tercatat: tidak ada tier poin untuk durasi keterlambatan ini.',
            default => 'Kesiangan diverifikasi.',
        };

        return response()->json(['message' => $pesan, 'poin_status' => $status]);
    }

    // ── GET /piket/resume — resume PER SHIFT petugas hari ini ────────────────
    public function resume(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);
        $shift = $this->shiftPetugas($request->user(), $tanggal);
        abort_if(! $shift, 422, 'Shift piket Anda hari ini tidak ditemukan.');

        $resume = PiketResume::tahunAjaran()
            ->where('tanggal', $tanggal)->where('piket_shift_id', $shift->id)
            ->with('teacher.user')->first();

        $now = Carbon::now('Asia/Jakarta');
        $mulai = $this->periodeMulai($tanggal, $shift, $now);

        return response()->json(['data' => [
            'tanggal' => $tanggal,
            'shift' => $this->presentShift($shift),
            'ringkasan' => $resume?->ringkasan,
            'kejadian_penting' => $resume?->kejadian_penting,
            'penyunting' => $resume?->teacher?->user?->nama,
            'diperbarui' => $resume?->updated_at?->toIso8601String(),
            // Rekap LIVE (dari akhir resume shift sebelumnya s.d. sekarang). Snapshot dibekukan saat simpan.
            'rekap' => $this->hitungRekap($tanggal, $now, $mulai),
        ]]);
    }

    // ── POST /piket/resume — simpan resume shift (upsert per tanggal+shift) ──
    public function simpanResume(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);
        $shift = $this->shiftPetugas($request->user(), $tanggal);
        abort_if(! $shift, 422, 'Shift piket Anda hari ini tidak ditemukan.');

        $data = $request->validate([
            'ringkasan' => ['required', 'string', 'max:5000'],
            'kejadian_penting' => ['nullable', 'string', 'max:5000'],
        ]);

        $now = Carbon::now('Asia/Jakarta');
        $mulai = $this->periodeMulai($tanggal, $shift, $now);   // = akhir resume shift sebelumnya (immutable)

        PiketResume::updateOrCreate(
            ['tanggal' => $tanggal, 'piket_shift_id' => $shift->id],
            [
                'periode_mulai' => $mulai,
                'ringkasan' => $data['ringkasan'],
                'kejadian_penting' => $data['kejadian_penting'] ?? null,
                'teacher_id' => $request->user()->teacher?->id,
                // Snapshot rekap periode [akhir resume shift sebelumnya, waktu simpan].
                'rekap' => $this->hitungRekap($tanggal, $now, $mulai),
            ],
        );

        return response()->json(['message' => 'Resume piket disimpan.']);
    }

    // ── GET /piket/cek-kehadiran?class_id=&nama= — cek kehadiran murid hari ini ──
    public function cekKehadiran(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $data = $request->validate([
            'class_id' => ['nullable', 'string'],
            'nama' => ['nullable', 'string', 'max:100'],
        ]);
        $nama = trim($data['nama'] ?? '');
        $classUuid = $data['class_id'] ?? null;

        if (! $classUuid && mb_strlen($nama) < 2) {
            return response()->json(['data' => [], 'tanggal' => $tanggal, 'message' => 'Pilih kelas atau ketik minimal 2 huruf nama.']);
        }

        $query = Student::query()
            ->whereHas('schoolClass', fn ($c) => $c->where('academic_year_id', TahunAjaran::id()))
            ->with('user:id,nama', 'schoolClass');

        if ($classUuid) {
            $kelas = $this->resolveKelas($classUuid);
            abort_if(! $kelas, 404, 'Kelas tidak ditemukan.');
            $query->where('class_id', $kelas->id);
        }
        if (mb_strlen($nama) >= 2) {
            $query->whereHas('user', fn ($u) => $u->whereRaw('LOWER(nama) LIKE ?', ['%'.mb_strtolower($nama).'%']));
        }

        $students = $query->limit(200)->get()->sortBy(fn ($s) => $s->user?->nama)->values();
        $ids = $students->pluck('id')->all();

        $daily = DailyAttendance::where('tanggal', $tanggal)->whereIn('student_id', $ids)->get()->keyBy('student_id');
        $kesiangan = IzinKesiangan::tahunAjaran()->where('tanggal', $tanggal)->whereIn('student_id', $ids)->get()->keyBy('student_id');

        $rows = $students->map(fn ($s) => [
            'nama' => $s->user?->nama,
            'nis' => $s->nis,
            'kelas' => $s->schoolClass?->label(),
            'status' => $daily->get($s->id)?->status ?? 'belum',
            'catatan' => $daily->get($s->id)?->catatan,
            'kesiangan_menit' => $kesiangan->get($s->id)?->terlambat_menit,
        ]);

        return response()->json(['data' => $rows, 'tanggal' => $tanggal]);
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
        $shift = $this->shiftPetugas($request->user(), $tanggal);
        abort_if(! $shift, 422, 'Shift piket Anda hari ini tidak ditemukan.');

        $resume = PiketResume::tahunAjaran()
            ->where('tanggal', $tanggal)->where('piket_shift_id', $shift->id)->first();
        $petugas = $shift->teachers->map(fn ($t) => $t->user?->nama)->filter()->unique()->values();
        // Rekap yang tercetak = snapshot saat resume disimpan; fallback rekap live bila belum disimpan.
        $now = Carbon::now('Asia/Jakarta');
        $rekap = $resume?->rekap ?? $this->hitungRekap($tanggal, $now, $this->periodeMulai($tanggal, $shift, $now));
        $tglLabel = Carbon::parse($tanggal)->locale('id')->isoFormat('dddd, D MMMM YYYY');
        $tanggalTtd = Carbon::parse($tanggal)->locale('id')->isoFormat('D MMMM YYYY');
        $shiftLabel = $shift->nama_shift.' ('.substr($shift->jam_mulai, 0, 5).'–'.substr($shift->jam_selesai, 0, 5).')';
        $filename = 'Resume_Piket_'.$tanggal.'_'.str_replace(' ', '', $shift->nama_shift);

        if ($request->format === 'xlsx') {
            return $this->exportResumeXlsx($filename, $tglLabel, $shiftLabel, $petugas->all(), $resume, $rekap, $tanggalTtd);
        }

        $printSettings = PrintSetting::instance($request->user()->id);
        $pdf = Pdf::loadView('reports.resume_piket', [
            'tanggalLabel' => $tglLabel,
            'shiftLabel' => $shiftLabel,
            'petugas' => $petugas->all(),
            'ringkasan' => $resume?->ringkasan ?? '(belum diisi)',
            'kejadianPenting' => $resume?->kejadian_penting,
            'rekap' => $rekap,
            'kopSuratPath' => 'file://'.public_path('images/kop_surat.jpg'),
            'printSettings' => $printSettings,
            'tanggalTtd' => $tanggalTtd,
        ])->setPaper($printSettings->paperDimensionsPt(), 'portrait');

        return $this->pdfResponse($pdf, "{$filename}.pdf", $request);
    }

    private function exportResumeXlsx(string $filename, string $tglLabel, string $shiftLabel, array $petugas, ?PiketResume $resume, array $rekap, string $tanggalTtd)
    {
        return $this->streamXlsx("{$filename}.xlsx", function (Writer $w) use ($tglLabel, $shiftLabel, $petugas, $resume, $rekap, $tanggalTtd) {
            $this->xlsxSetColumnWidths($w, [1 => 5, 2 => 24, 3 => 60]);
            $label = $this->xlsxLabelStyle();
            $periode = ($rekap['mulai'] ?? '-').' – '.($rekap['waktu'] ?? '-');

            $w->addRow(Row::fromValuesWithStyle(['RESUME PIKET'], $this->xlsxTitleStyle()));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(new Row([new StringCell(''), new StringCell('Tanggal', $label), new StringCell(": {$tglLabel}")]));
            $w->addRow(new Row([new StringCell(''), new StringCell('Shift', $label), new StringCell(": {$shiftLabel}")]));
            $w->addRow(new Row([new StringCell(''), new StringCell('Petugas Piket', $label), new StringCell(': '.(empty($petugas) ? '-' : implode(', ', $petugas)))]));
            $w->addRow(new Row([new StringCell(''), new StringCell('Periode rekap', $label), new StringCell(": {$periode}")]));
            $w->addRow(Row::fromValues(['']));

            $w->addRow(new Row([new StringCell(''), new StringCell('Ringkasan', $label), new StringCell(': '.($resume?->ringkasan ?? '-'), $this->xlsxCellStyle())]));
            $w->addRow(new Row([new StringCell(''), new StringCell('Kejadian Penting', $label), new StringCell(': '.($resume?->kejadian_penting ?? '-'), $this->xlsxCellStyle())]));
            $w->addRow(Row::fromValues(['']));

            $ag = $rekap['agenda'] ?? [];
            $pr = $rekap['presensi'] ?? [];
            $w->addRow(new Row([new StringCell(''), new StringCell('Agenda guru terisi', $label), new StringCell(': '.($ag['terisi'] ?? 0).' dari '.($ag['berlangsung'] ?? 0).' sesi (periode ini)')]));
            $w->addRow(new Row([new StringCell(''), new StringCell('Presensi siswa terisi', $label), new StringCell(': '.($pr['terisi'] ?? 0).' dari '.($pr['berlangsung'] ?? 0).' sesi (periode ini)')]));
            $w->addRow(Row::fromValues(['']));

            $w->addRow(Row::fromValuesWithStyle(['', 'Rekap Kehadiran per Kelas'], $this->xlsxLabelStyle()));
            $w->addRow(Row::fromValuesWithStyle(['', 'Kelas', 'Hadir', 'Sakit', 'Izin', 'Alpha', 'Total'], $this->xlsxHeaderStyle()));
            foreach (($rekap['kehadiran_kelas'] ?? []) as $k) {
                $w->addRow(Row::fromValuesWithStyle(['', $k['kelas'] ?? '-', $k['hadir'] ?? 0, $k['sakit'] ?? 0, $k['izin'] ?? 0, $k['alpha'] ?? 0, $k['total'] ?? 0], $this->xlsxCellStyle()));
            }
            if (empty($rekap['kehadiran_kelas'])) {
                $w->addRow(new Row([new StringCell(''), new StringCell('(belum ada absensi harian tercatat pada periode ini)')]));
            }

            // ── Blok tanda tangan petugas (kolom kanan, rapi) ────────────────────
            $ttd = empty($petugas) ? ['Petugas Piket'] : $petugas;
            $boldRight = $this->xlsxSignNameStyle();
            $right = $this->xlsxRightStyle();
            $w->addRow(Row::fromValues(['']));
            $w->addRow(Row::fromValues(['']));
            $w->addRow(new Row([new StringCell(''), new StringCell(''), new StringCell("Cimahi, {$tanggalTtd}", $right)]));
            foreach ($ttd as $nama) {
                $w->addRow(new Row([new StringCell(''), new StringCell(''), new StringCell('Petugas Piket,', $right)]));
                $w->addRow(Row::fromValues(['']));
                $w->addRow(Row::fromValues(['']));
                $w->addRow(new Row([new StringCell(''), new StringCell(''), new StringCell($nama, $boldRight)]));
                $w->addRow(Row::fromValues(['']));
            }
        });
    }

    private function xlsxSignNameStyle(): Style
    {
        return (new Style)
            ->withFontBold(true)
            ->withCellAlignment(CellAlignment::RIGHT);
    }

    private function xlsxRightStyle(): Style
    {
        return (new Style)
            ->withCellAlignment(CellAlignment::RIGHT);
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
        // Terlambat kembali = sudah keluar, lewat batas berlaku, belum terpindai masuk.
        $now = Carbon::now('Asia/Jakarta');
        $terlambat = $i->status === IzinKeluarStatus::Keluar
            && $i->berlaku_sampai && $now->gt($i->berlaku_sampai);

        return [
            'id' => $i->uuid,
            'tanggal' => $i->tanggal->toDateString(),
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
            'terlambat_kembali' => $terlambat,
            'terlambat_menit' => $terlambat ? $i->berlaku_sampai->diffInMinutes($now) : 0,
            // Sumber validasi kembali: sekuriti (scan) vs piket (manual).
            'validasi_sekuriti' => $i->status === IzinKeluarStatus::Kembali && $i->scan_masuk_oleh !== null,
            'validasi_piket' => $i->kembali_manual_oleh !== null,
            'validator_kembali' => $i->kembaliManualOleh?->user?->nama,
            'catatan_kembali' => $i->catatan_kembali,
        ];
    }

    /** Abort 403 bila user bukan petugas piket pada tanggal itu. */
    private function pastikanPetugas(Request $request, string $tanggal): void
    {
        abort_unless(PiketAccess::isPetugas($request->user(), $tanggal), 403, 'Anda tidak bertugas piket hari ini.');
    }

    /** Nama hari (senin..sabtu) dari tanggal; null utk Minggu/tanggal invalid. */
    private function hariDari(string $tanggal): ?string
    {
        $iso = Carbon::parse($tanggal)->dayOfWeekIso;   // 1=Senin .. 7=Minggu

        return [1 => 'senin', 2 => 'selasa', 3 => 'rabu', 4 => 'kamis', 5 => 'jumat', 6 => 'sabtu'][$iso] ?? null;
    }

    /** Shift piket pada hari-dalam-seminggu dari tanggal (dengan petugas). Kosong bila Sabtu/Minggu. */
    private function shiftsHariIni(string $tanggal): Collection
    {
        $hari = $this->hariDari($tanggal);
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

    /** Sesi jadwal reguler hari itu (kelas PKL/Kokurikuler dikecualikan), terurut jam mulai. */
    private function jadwalHariIni(string $tanggal): Collection
    {
        $hari = $this->hariDari($tanggal);
        if (! $hari) {
            return collect();
        }

        return Schedule::tahunAjaran()
            ->where('hari', $hari)
            ->where('aktif', true)
            ->with(['subject', 'schoolClass', 'teacher.user'])
            ->get()
            ->reject(fn ($s) => PklMode::isAgendaExempt($s->class_id, $tanggal) || KokurikulerMode::isAgendaExempt($s->class_id, $tanggal))
            ->sortBy(fn ($s) => BellSchedule::resolve($s, $tanggal)['jam_mulai'])
            ->values();
    }

    /** Shift petugas untuk resume: shift aktif sekarang di antara shift-nya hari itu; else pertama. */
    private function shiftPetugas(User $user, string $tanggal): ?PiketShift
    {
        $teacher = $user->teacher ?? Teacher::where('user_id', $user->id)->first();
        if (! $teacher) {
            return null;
        }
        $hari = $this->hariDari($tanggal);
        if (! $hari) {
            return null;
        }

        $shifts = PiketShift::tahunAjaran()
            ->where('hari', $hari)
            ->whereHas('teachers', fn ($q) => $q->where('teachers.id', $teacher->id))
            ->with('teachers.user')
            ->orderBy('urutan')->orderBy('jam_mulai')
            ->get();
        if ($shifts->isEmpty()) {
            return null;
        }

        $jamNow = Carbon::now('Asia/Jakarta')->format('H:i:s');
        $aktif = $shifts->first(fn ($s) => Carbon::parse($s->jam_mulai)->format('H:i:s') <= $jamNow
            && $jamNow < Carbon::parse($s->jam_selesai)->format('H:i:s'));

        return $aktif ?? $shifts->first();
    }

    private function presentShift(PiketShift $shift): array
    {
        return [
            'id' => $shift->id,
            'nama' => $shift->nama_shift,
            'jam_mulai' => substr($shift->jam_mulai, 0, 5),
            'jam_selesai' => substr($shift->jam_selesai, 0, 5),
            'petugas' => $shift->teachers->map(fn ($t) => $t->user?->nama)->filter()->values(),
        ];
    }

    /**
     * Rekap "sampai waktu $now": kehadiran per kelas (absensi harian piket), serta pengisian
     * agenda guru & presensi siswa untuk sesi yang SUDAH berlangsung (jam mulai <= sekarang).
     */
    /**
     * Rekap untuk WINDOW shift ini: [jam_mulai shift, $now] — MELANJUTKAN dari shift sebelumnya
     * (shift kontigu: mulai shift ini = selesai shift sebelumnya), bukan kumulatif sejak 00:00.
     * Mencakup absensi harian yang dicatat + sesi yang berlangsung dalam window itu.
     */
    /**
     * Awal periode rekap resume shift ini = waktu resume shift SEBELUMNYA dibuat (melanjutkan
     * tanpa jeda), bukan jam mulai shift.
     *
     * Anti-anomali: "sebelumnya" ditentukan oleh URUTAN SHIFT (jam_mulai), BUKAN waktu simpan.
     * Jadi urutan simpan yang tidak wajar (shift akhir menyimpan lebih dulu) tak pernah membuat
     * window mundur. Diambil dari resume shift berurutan-sebelumnya yang paling dekat & sudah
     * punya resume (rantai melompati shift yang belum bikin resume); kalau tak ada → awal hari
     * (agar tak ada aktivitas awal yang terlewat).
     *
     * Immutable: bila resume shift ini sudah ada, pakai periode_mulai tersimpan apa adanya.
     */
    private function periodeMulai(string $tanggal, PiketShift $shift, Carbon $now): Carbon
    {
        $self = PiketResume::tahunAjaran()
            ->where('tanggal', $tanggal)->where('piket_shift_id', $shift->id)->first();
        if ($self && $self->periode_mulai) {
            return $self->periode_mulai->copy()->setTimezone('Asia/Jakarta');
        }

        $shiftMulai = Carbon::parse($shift->jam_mulai)->format('H:i:s');
        $prev = PiketResume::tahunAjaran()
            ->where('tanggal', $tanggal)
            ->where('piket_shift_id', '!=', $shift->id)
            ->with('shift')
            ->get()
            ->filter(fn ($r) => $r->shift && Carbon::parse($r->shift->jam_mulai)->format('H:i:s') < $shiftMulai)
            ->sortByDesc(fn ($r) => Carbon::parse($r->shift->jam_mulai)->format('H:i:s'))
            ->first();

        return $prev
            ? $prev->updated_at->copy()->setTimezone('Asia/Jakarta')
            : Carbon::parse($tanggal.' 00:00:00', 'Asia/Jakarta');
    }

    private function hitungRekap(string $tanggal, Carbon $now, Carbon $mulai): array
    {
        $jamNow = $now->format('H:i:s');
        $mulaiJam = $mulai->format('H:i:s');

        // Kehadiran per kelas dari absensi harian yang DICATAT dalam window shift ini.
        $daily = DailyAttendance::where('tanggal', $tanggal)->get(['class_id', 'status', 'created_at'])
            ->filter(function ($d) use ($mulaiJam, $jamNow) {
                $t = $d->created_at?->copy()->setTimezone('Asia/Jakarta')->format('H:i:s');

                return $t !== null && $t >= $mulaiJam && $t <= $jamNow;
            })->values();

        $labels = SchoolClass::whereIn('id', $daily->pluck('class_id')->unique()->all())->get()->keyBy('id');
        $kehadiranKelas = $daily->groupBy('class_id')->map(function ($rows, $classId) use ($labels) {
            $c = fn ($st) => $rows->where('status', $st)->count();

            return [
                'kelas' => $labels->get($classId)?->label() ?? '-',
                'hadir' => $c('hadir'), 'sakit' => $c('sakit'), 'izin' => $c('izin'), 'alpha' => $c('alpha'),
                'total' => $rows->count(),
            ];
        })->sortBy('kelas')->values();

        $total = [
            'hadir' => $daily->where('status', 'hadir')->count(),
            'sakit' => $daily->where('status', 'sakit')->count(),
            'izin' => $daily->where('status', 'izin')->count(),
            'alpha' => $daily->where('status', 'alpha')->count(),
            'total' => $daily->count(),
        ];

        // Agenda & presensi untuk sesi yang MULAI dalam window shift ini.
        $berlangsung = $this->jadwalHariIni($tanggal)
            ->filter(function ($s) use ($tanggal, $mulaiJam, $jamNow) {
                $jm = BellSchedule::resolve($s, $tanggal)['jam_mulai'];

                return $jm >= $mulaiJam && $jm <= $jamNow;
            })
            ->values();
        $ids = $berlangsung->pluck('id')->all();
        $agendas = Agenda::whereIn('schedule_id', $ids)->whereDate('tanggal', $tanggal)
            ->withCount('studentAttendances')->get()->keyBy('schedule_id');

        $agendaTerisi = 0;
        $presensiTerisi = 0;
        foreach ($berlangsung as $s) {
            $a = $agendas->get($s->id);
            if ($a && $a->status === AgendaStatus::Submitted) {
                $agendaTerisi++;
            }
            if ($a && $a->student_attendances_count > 0) {
                $presensiTerisi++;
            }
        }
        $totalSesi = $berlangsung->count();

        return [
            'mulai' => substr($mulaiJam, 0, 5),
            'waktu' => $now->format('H:i'),
            'kehadiran_kelas' => $kehadiranKelas,
            'kehadiran_total' => $total,
            'agenda' => ['berlangsung' => $totalSesi, 'terisi' => $agendaTerisi, 'belum' => $totalSesi - $agendaTerisi],
            'presensi' => ['berlangsung' => $totalSesi, 'terisi' => $presensiTerisi, 'belum' => $totalSesi - $presensiTerisi],
        ];
    }
}
