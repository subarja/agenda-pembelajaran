<?php

namespace App\Http\Controllers\Api;

use App\Enums\SubstitutionStatus;
use App\Http\Controllers\Controller;
use App\Models\Schedule;
use App\Models\SubstitutionRequest;
use App\Models\SubstitutionSession;
use App\Models\Teacher;
use App\Notifications\SubstitutionApprovedNotification;
use App\Notifications\SubstitutionRejectedNotification;
use App\Notifications\SubstitutionRequestedNotification;
use App\Services\SubstitutionService;
use App\Support\PklMode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SubstitutionController extends Controller
{
    public function __construct(private readonly SubstitutionService $service) {}

    /** GET /inval/sesi-saya?tanggal_mulai=&tanggal_akhir= — sesi milik pengaju + kelayakannya. */
    public function sesiSaya(Request $request): JsonResponse
    {
        $request->validate([
            'tanggal_mulai' => ['required', 'date'],
            'tanggal_akhir' => ['required', 'date', 'after_or_equal:tanggal_mulai'],
        ]);

        $teacher = $this->teacher($request);

        $mulai = Carbon::parse($request->tanggal_mulai, config('app.school_timezone'))->startOfDay();
        $akhir = Carbon::parse($request->tanggal_akhir, config('app.school_timezone'))->startOfDay();

        // Rentang dibatasi supaya satu request tidak menghitung kelayakan ribuan sesi.
        abort_if($mulai->diffInDays($akhir) > 31, 422, 'Rentang tanggal maksimal 31 hari.');

        return response()->json(['data' => $this->service->sesiMilikGuru($teacher, $mulai, $akhir)]);
    }

    /**
     * GET /inval/calon-pengganti?sesi[]=<schedule_uuid>|<Y-m-d>
     *
     * Daftar guru + tanda bentrok untuk sesi yang sedang dipilih. Bentrok tidak memblokir,
     * hanya memperingatkan (lihat SubstitutionService::calonPengganti).
     */
    public function calonPengganti(Request $request): JsonResponse
    {
        $request->validate([
            'sesi'   => ['required', 'array', 'min:1', 'max:12'],
            'sesi.*' => ['string'],
        ]);

        $teacher = $this->teacher($request);
        $sesi    = $this->uraikanSesi($request->sesi, $teacher);

        return response()->json(['data' => $this->service->calonPengganti($teacher, $sesi)]);
    }

    /** POST /inval — ajukan satu pengganti untuk beberapa sesi sekaligus. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'substitute_teacher_id' => ['required', 'string'],
            'alasan'                => ['required', 'string', 'max:500'],
            'pesan'                 => ['nullable', 'string', 'max:2000'],
            'link_tugas'            => ['nullable', 'url', 'max:500'],
            'sesi'                  => ['required', 'array', 'min:1', 'max:12'],
            'sesi.*'                => ['string'],
        ]);

        $pengaju   = $this->teacher($request);
        $pengganti = Teacher::where('uuid', $data['substitute_teacher_id'])->firstOrFail();

        abort_if($pengganti->id === $pengaju->id, 422, 'Anda tidak bisa mengajukan diri sendiri sebagai pengganti.');

        $sesi = $this->uraikanSesi($data['sesi'], $pengaju);

        // Kelayakan diperiksa ULANG di sini, tidak cukup mengandalkan daftar yang dikirim
        // frontend: antara layar dibuka dan tombol ditekan, guru lain bisa saja sudah
        // mengajukan sesi yang sama, atau batas waktunya lewat.
        foreach ($sesi as $s) {
            if ($alasan = $this->service->alasanTidakBolehDiajukan($s['schedule'], $s['tanggal'])) {
                return response()->json(['message' => "Sesi {$s['tanggal']}: {$alasan}"], 422);
            }
        }

        $req = DB::transaction(function () use ($pengaju, $pengganti, $data, $sesi, $request) {
            $req = SubstitutionRequest::create([
                'requester_teacher_id'  => $pengaju->id,
                'substitute_teacher_id' => $pengganti->id,
                'alasan'                => $data['alasan'],
                'pesan'                 => $data['pesan'] ?? null,
                'link_tugas'            => $data['link_tugas'] ?? null,
                'status'                => SubstitutionStatus::Diajukan,
                'created_by'            => $request->user()->id,
                'updated_by'            => $request->user()->id,
            ]);

            foreach ($sesi as $s) {
                SubstitutionSession::create([
                    'request_id'  => $req->id,
                    'schedule_id' => $s['schedule']->id,
                    'tanggal'     => $s['tanggal'],
                    'slot_aktif'  => 1, // pengajuan lahir dalam keadaan aktif — lihat migrasi
                ]);
            }

            return $req;
        });

        $pengganti->user?->notify(new SubstitutionRequestedNotification($req->fresh('sessions.schedule')));

        return response()->json([
            'message' => 'Pengajuan terkirim. Menunggu jawaban '.$pengganti->user?->nama.'.',
            'data'    => ['id' => $req->uuid],
        ], 201);
    }

    /** GET /inval/masuk — pengajuan yang ditujukan KE saya (saya calon penggantinya). */
    public function masuk(Request $request): JsonResponse
    {
        $teacher = $this->teacher($request);

        $items = SubstitutionRequest::where('substitute_teacher_id', $teacher->id)
            ->with(['requester.user', 'substitute.user', 'sessions.schedule.subject', 'sessions.schedule.schoolClass'])
            ->latest()
            ->get()
            ->map(fn ($r) => $this->format($r));

        return response()->json(['data' => $items]);
    }

    /** GET /inval/keluar — pengajuan yang SAYA buat. */
    public function keluar(Request $request): JsonResponse
    {
        $teacher = $this->teacher($request);

        $items = SubstitutionRequest::where('requester_teacher_id', $teacher->id)
            ->with(['requester.user', 'substitute.user', 'sessions.schedule.subject', 'sessions.schedule.schoolClass'])
            ->latest()
            ->get()
            ->map(fn ($r) => $this->format($r));

        return response()->json(['data' => $items]);
    }

    /** PUT /inval/{uuid}/setujui — hanya guru pengganti yang dituju. */
    public function setujui(Request $request, string $uuid): JsonResponse
    {
        $req     = $this->pengajuanMenunggu($uuid);
        $teacher = $this->teacher($request);

        abort_if($req->substitute_teacher_id !== $teacher->id, 403, 'Pengajuan ini bukan ditujukan kepada Anda.');

        $req->pindahStatus(SubstitutionStatus::Disetujui, $request->user()->id);

        $req->requester->user?->notify(new SubstitutionApprovedNotification($req->fresh('sessions.schedule')));

        return response()->json(['message' => 'Pengajuan disetujui. Kewajiban mengisi agenda sesi ini kini menjadi milik Anda.']);
    }

    /** PUT /inval/{uuid}/tolak — hanya guru pengganti yang dituju. */
    public function tolak(Request $request, string $uuid): JsonResponse
    {
        $data    = $request->validate(['alasan_penolakan' => ['required', 'string', 'max:500']]);
        $req     = $this->pengajuanMenunggu($uuid);
        $teacher = $this->teacher($request);

        abort_if($req->substitute_teacher_id !== $teacher->id, 403, 'Pengajuan ini bukan ditujukan kepada Anda.');

        $req->pindahStatus(SubstitutionStatus::Ditolak, $request->user()->id, $data['alasan_penolakan']);

        $req->requester->user?->notify(new SubstitutionRejectedNotification($req->fresh('sessions.schedule')));

        return response()->json(['message' => 'Pengajuan ditolak. Pengaju sudah diberi tahu.']);
    }

    /** PUT /inval/{uuid}/batal — hanya pengaju, dan hanya selama belum dijawab. */
    public function batal(Request $request, string $uuid): JsonResponse
    {
        $req     = $this->pengajuanMenunggu($uuid);
        $teacher = $this->teacher($request);

        abort_if($req->requester_teacher_id !== $teacher->id, 403, 'Ini bukan pengajuan Anda.');

        $req->pindahStatus(SubstitutionStatus::Dibatalkan, $request->user()->id);

        return response()->json(['message' => 'Pengajuan dibatalkan.']);
    }

    // ── Pembantu ──────────────────────────────────────────────────────────────

    private function teacher(Request $request): Teacher
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, 403, 'Menu ini hanya untuk akun guru.');

        return $teacher;
    }

    /**
     * Pengajuan yang masih menunggu jawaban. Sengaja menolak status lain dengan 422, bukan
     * 404: guru yang menekan tombol dari layar basi berhak tahu apa yang sudah terjadi.
     */
    private function pengajuanMenunggu(string $uuid): SubstitutionRequest
    {
        $req = SubstitutionRequest::where('uuid', $uuid)->with('requester.user', 'substitute.user')->firstOrFail();

        abort_if(
            $req->status !== SubstitutionStatus::Diajukan,
            422,
            'Pengajuan ini sudah '.strtolower($req->status->label()).', tidak bisa diubah lagi.',
        );

        return $req;
    }

    /**
     * "scheduleUuid|Y-m-d" → schedule + tanggal, sekaligus menegakkan bahwa jadwalnya
     * MEMANG milik pengaju. Tanpa pemeriksaan ini, guru bisa mengalihkan sesi milik guru
     * lain — dan pemilik aslinya kehilangan sesi itu dari daftar "perlu diisi"-nya.
     *
     * @return \Illuminate\Support\Collection<int,array{schedule:Schedule, tanggal:string}>
     */
    private function uraikanSesi(array $raw, Teacher $pengaju): \Illuminate\Support\Collection
    {
        return collect($raw)->map(function (string $item) use ($pengaju) {
            [$scheduleUuid, $tanggal] = array_pad(explode('|', $item, 2), 2, null);

            abort_if(! $scheduleUuid || ! $tanggal, 422, 'Format sesi tidak valid.');
            abort_unless(Carbon::hasFormat($tanggal, 'Y-m-d'), 422, 'Format tanggal sesi tidak valid.');

            $schedule = Schedule::where('uuid', $scheduleUuid)->with('subject', 'schoolClass')->firstOrFail();

            abort_if($schedule->teacher_id !== $pengaju->id, 403, 'Anda hanya bisa mengajukan sesi dari jadwal Anda sendiri.');

            return ['schedule' => $schedule, 'tanggal' => $tanggal];
        });
    }

    private function format(SubstitutionRequest $r): array
    {
        return [
            'id'               => $r->uuid,
            'status'           => $r->status->value,
            'status_label'     => $r->status->label(),
            'pengaju'          => $r->requester->user?->nama,
            'pengganti'        => $r->substitute->user?->nama,
            'alasan'           => $r->alasan,
            'pesan'            => $r->pesan,
            'link_tugas'       => $r->link_tugas,
            'alasan_penolakan' => $r->alasan_penolakan,
            'responded_at'     => $r->responded_at?->timezone(config('app.school_timezone'))->format('d/m/Y H:i'),
            'created_at'       => $r->created_at->timezone(config('app.school_timezone'))->format('d/m/Y H:i'),
            'sesi'             => $r->sessions->map(function (SubstitutionSession $s) {
                $jam = $s->schedule ? \App\Support\BellSchedule::resolve($s->schedule, $s->tanggal->toDateString()) : null;

                return [
                    'tanggal'     => $s->tanggal->toDateString(),
                    'hari'        => $s->schedule?->hari->value,
                    'jam_mulai'   => substr($jam['jam_mulai'] ?? '', 0, 5),
                    'jam_selesai' => substr($jam['jam_selesai'] ?? '', 0, 5),
                    'kelas'       => $s->schedule ? $this->service->labelKelas($s->schedule) : '—',
                    'mapel'       => $s->schedule ? PklMode::subjectLabelFor($s->schedule) : null,
                ];
            })->values(),
        ];
    }
}
