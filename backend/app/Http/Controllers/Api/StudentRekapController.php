<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AgendaStudentScore;
use App\Models\CharacterInput;
use App\Models\Note;
use App\Models\Recommendation;
use App\Models\Student;
use App\Models\StudentAttendance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class StudentRekapController extends Controller
{
    /**
     * GET /students/{uuid}/rekap
     * Rekap terintegrasi 4 dimensi per siswa — dipakai EWS drill-down,
     * wali kelas, dan BK.
     */
    public function show(Request $request, string $uuid): JsonResponse
    {
        $student = Student::where('uuid', $uuid)
            ->with(['user', 'schoolClass', 'schoolClass.waliKelas'])
            ->firstOrFail();

        $this->authorizeAccess($request, $student);

        return response()->json([
            'data' => [
                'profil'          => $this->buildProfil($student),
                'kehadiran'       => $this->buildKehadiran($student),
                'karakter'        => $this->buildKarakter($student),
                'nilai'           => $this->buildNilai($student),
                'rekomendasi'     => $this->buildRekomendasi($student),
                'riwayat_bulanan' => $this->buildRiwayatBulanan($student),
            ],
        ]);
    }

    // ── Akses: semua peran kecuali siswa lain dan orang tua lain ─────────────
    private function authorizeAccess(Request $request, Student $student): void
    {
        $user = $request->user();
        $role = $user->role->value;

        if (in_array($role, ['admin', 'wakasek', 'bk'])) return;

        if ($role === 'guru' || $role === 'wali_kelas') return;

        if ($role === 'siswa' && $user->student?->id === $student->id) return;

        if ($role === 'orang_tua' && $user->linked_student_id === $student->id) return;

        abort(403, 'Anda tidak memiliki akses ke rekap siswa ini.');
    }

    // ── Profil ────────────────────────────────────────────────────────────────
    private function buildProfil(Student $student): array
    {
        $kelas = $student->schoolClass;
        return [
            'id'          => $student->uuid,
            'nama'        => $student->user->nama,
            'nis'         => $student->nis,
            'nisn'        => $student->nisn,
            'angkatan'    => $student->angkatan,
            'kelas'       => $kelas ? [
                'label'      => $kelas->tingkat->value . ' ' . $kelas->jurusan . ' - ' . $kelas->rombel,
                'wali_kelas' => $kelas->waliKelas?->nama,
            ] : null,
            'wali_nama'   => $student->wali_nama,
            'wali_kontak' => $student->wali_kontak,
        ];
    }

    // ── Dimensi 1: Kehadiran ──────────────────────────────────────────────────
    private function buildKehadiran(Student $student): array
    {
        $all   = StudentAttendance::where('student_id', $student->id)->with('agenda:id,tanggal')->get();
        $total = $all->count();
        $hadir = $all->where('status.value', 'hadir')->count();
        $sakit = $all->where('status.value', 'sakit')->count();
        $izin  = $all->where('status.value', 'izin')->count();
        $alpha = $all->where('status.value', 'alpha')->count();
        $score = $total > 0 ? round(($hadir / $total) * 100, 2) : 100.0;

        // Alpha berturut-turut terbanyak
        $sorted    = $all->sortBy(fn ($a) => $a->agenda?->tanggal);
        $maxStreak = 0;
        $streak    = 0;
        foreach ($sorted as $a) {
            if ($a->status->value === 'alpha') { $streak++; $maxStreak = max($maxStreak, $streak); }
            else $streak = 0;
        }

        // 5 ketidakhadiran terbaru
        $recentAbsences = $all->whereNotIn('status.value', ['hadir'])
            ->sortByDesc(fn ($a) => $a->agenda?->tanggal)
            ->take(5)
            ->map(fn ($a) => [
                'tanggal' => $a->agenda?->tanggal?->format('Y-m-d'),
                'status'  => $a->status->value,
            ])->values();

        return [
            'score'           => $score,
            'total'           => $total,
            'hadir'           => $hadir,
            'sakit'           => $sakit,
            'izin'            => $izin,
            'alpha'           => $alpha,
            'max_alpha_streak'=> $maxStreak,
            'warning'         => $score < 80,
            'recent_absences' => $recentAbsences,
        ];
    }

    // ── Dimensi 2: Karakter ───────────────────────────────────────────────────
    private function buildKarakter(Student $student): array
    {
        $inputs = CharacterInput::where('student_id', $student->id)
            ->with(['subitem.category', 'teacher.user'])
            ->orderByDesc('created_at')
            ->get();

        $netScore   = $inputs->sum(fn ($i) =>
            $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot)
        );
        $totalPos   = $inputs->where('sign.value', 'positif')->sum(fn ($i) => abs($i->subitem->bobot));
        $totalNeg   = $inputs->where('sign.value', 'negatif')->sum(fn ($i) => abs($i->subitem->bobot));

        // Per kategori
        $perKategori = $inputs->groupBy(fn ($i) => $i->subitem->category->nama)
            ->map(fn ($group, $nama) => [
                'nama'  => $nama,
                'score' => $group->sum(fn ($i) => $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot)),
                'count' => $group->count(),
            ])->values();

        // Riwayat 10 input terbaru
        $riwayat = $inputs->take(10)->map(fn ($i) => [
            'kategori' => $i->subitem->category->nama,
            'subitem'  => $i->subitem->deskripsi,
            'poin'     => $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot),
            'sign'     => $i->sign->value,
            'guru'     => $i->teacher->user->nama,
            'catatan'  => $i->catatan,
            'tanggal'  => $i->created_at->format('Y-m-d H:i'),
        ])->values();

        return [
            'net_score'    => $netScore,
            'total_positif'=> $totalPos,
            'total_negatif'=> $totalNeg,
            'count'        => $inputs->count(),
            'warning'      => $netScore < 0,
            'per_kategori' => $perKategori,
            'riwayat'      => $riwayat,
        ];
    }

    // ── Dimensi 3: Nilai Aktivitas ────────────────────────────────────────────
    private function buildNilai(Student $student): array
    {
        $scores = AgendaStudentScore::where('student_id', $student->id)
            ->with('agenda:id,tanggal,schedule_id', 'agenda.schedule.subject:id,nama')
            ->orderByDesc('created_at')
            ->get();

        $avg  = $scores->count() > 0 ? round($scores->avg('nilai'), 1) : null;
        $tren = $scores->take(10)->map(fn ($s) => [
            'tanggal' => $s->agenda?->tanggal?->format('Y-m-d'),
            'mapel'   => $s->agenda?->schedule?->subject?->nama,
            'nilai'   => $s->nilai,
        ])->values();

        return [
            'avg'     => $avg,
            'count'   => $scores->count(),
            'warning' => $avg !== null && $avg < 70,
            'tren'    => $tren,
        ];
    }

    // ── Rekomendasi Aktif ─────────────────────────────────────────────────────
    private function buildRekomendasi(Student $student): array
    {
        $recs = Recommendation::where('student_id', $student->id)
            ->with(['threshold', 'assignedTo'])
            ->orderByDesc('created_at')
            ->get();

        return $recs->map(fn ($r) => [
            'id'             => $r->uuid,
            'rekomendasi'    => $r->threshold?->rekomendasi ?? $r->alasan_manual ?? 'Kasus manual (tanpa ambang otomatis)',
            'sifat'          => $r->threshold?->sifat->value ?? 'manual',
            'akumulasi'      => $r->akumulasi_saat_trigger,
            'status'         => $r->status->value,
            'ditugaskan_ke'  => $r->assignedTo?->nama,
            'hasil'          => $r->hasil_tindak_lanjut,
            'dibuat_pada'    => $r->created_at->format('Y-m-d H:i'),
            'ditangani_pada' => $r->ditangani_pada?->format('Y-m-d H:i'),
        ])->values()->toArray();
    }

    // ── Riwayat Bulanan (kehadiran + poin karakter per bulan) ─────────────────
    private function buildRiwayatBulanan(Student $student): array
    {
        // 6 bulan terakhir
        $months = collect(range(5, 0))->map(fn ($i) => Carbon::now()->subMonths($i)->format('Y-m'));

        return $months->map(function ($ym) use ($student) {
            [$year, $month] = explode('-', $ym);

            $att   = StudentAttendance::where('student_id', $student->id)
                ->whereHas('agenda', fn ($q) => $q->whereYear('tanggal', $year)->whereMonth('tanggal', $month))
                ->get();
            $total = $att->count();
            $hadir = $att->where('status.value', 'hadir')->count();

            $inputs = CharacterInput::where('student_id', $student->id)
                ->whereYear('created_at', $year)->whereMonth('created_at', $month)
                ->with('subitem')->get();
            $poin = $inputs->sum(fn ($i) => $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot));

            return [
                'bulan'      => Carbon::createFromFormat('Y-m', $ym)->locale('id')->isoFormat('MMM YY'),
                'kehadiran'  => $total > 0 ? round(($hadir / $total) * 100, 1) : null,
                'poin'       => $poin,
                'total_sesi' => $total,
            ];
        })->values()->toArray();
    }

    // ── Update status rekomendasi ─────────────────────────────────────────────
    public function updateRekomendasi(Request $request, string $studentUuid, string $rekUuid): JsonResponse
    {
        $student = Student::where('uuid', $studentUuid)->with('schoolClass')->firstOrFail();
        $rek     = Recommendation::where('uuid', $rekUuid)->where('student_id', $student->id)->firstOrFail();

        // Dulu TIDAK ADA otorisasi sama sekali — guru mana pun (bukan cuma wali kelas
        // siswa ybs) bisa langsung ubah status rekomendasi ke "selesai". Ditemukan saat
        // audit ulang GK3/GK7 — samakan aturannya dengan RecommendationController::
        // updateStatus() (endpoint yang lebih baru utk kasus yang sama).
        $user    = $request->user();
        $isAdmin = in_array($user->role->value, ['admin', 'wakasek'], true);
        $isWali  = $student->schoolClass?->wali_kelas_id === $user->id;
        abort_if(! $isAdmin && ! $isWali, 403, 'Hanya wali kelas siswa ini yang dapat mengubah status rekomendasi.');

        $data = $request->validate([
            'status'             => ['required', 'in:pending,proses,selesai,diabaikan'],
            'hasil_tindak_lanjut'=> ['nullable', 'string', 'max:2000'],
        ]);

        $rek->update([
            'status'              => $data['status'],
            'hasil_tindak_lanjut' => $data['hasil_tindak_lanjut'] ?? $rek->hasil_tindak_lanjut,
            'ditangani_pada'      => in_array($data['status'], ['selesai', 'diabaikan']) ? now() : $rek->ditangani_pada,
        ]);

        return response()->json(['message' => 'Status rekomendasi diperbarui.']);
    }
}
