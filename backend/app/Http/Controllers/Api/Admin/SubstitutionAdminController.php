<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\SubstitutionStatus;
use App\Http\Controllers\Controller;
use App\Models\SubstitutionRequest;
use App\Models\SubstitutionSession;
use App\Services\SubstitutionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubstitutionAdminController extends Controller
{
    public function __construct(private readonly SubstitutionService $service) {}

    /**
     * GET /admin/inval — seluruh pengajuan guru inval, untuk pemantauan kurikulum.
     *
     * Admin melihat SEMUA kolom, termasuk pesan dan link tugas: ini catatan administratif
     * tentang siapa mengajukan ke siapa, kapan disetujui, dan apa alasannya. Tidak ada
     * penyaringan kepemilikan seperti pada data pembinaan siswa — pengajuan inval adalah
     * urusan dinas, bukan data pribadi siswa.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status'        => ['nullable', 'string'],
            'tanggal_mulai' => ['nullable', 'date'],
            'tanggal_akhir' => ['nullable', 'date', 'after_or_equal:tanggal_mulai'],
            'search'        => ['nullable', 'string', 'max:100'],
            'per_page'      => ['nullable'],
        ]);

        $query = SubstitutionRequest::with([
            'requester.user:id,nama', 'substitute.user:id,nama',
            'sessions.schedule.subject', 'sessions.schedule.schoolClass',
        ])->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Rentang tanggal menyaring berdasarkan TANGGAL SESI, bukan tanggal pengajuan —
        // yang dicari kurikulum adalah "siapa yang diganti pada minggu ini", bukan "siapa
        // yang mengetik formulir pada minggu ini".
        if ($request->filled('tanggal_mulai') || $request->filled('tanggal_akhir')) {
            $mulai = $request->tanggal_mulai ?? '1900-01-01';
            $akhir = $request->tanggal_akhir ?? '2999-12-31';

            $query->whereHas('sessions', fn ($q) => $q->whereBetween('tanggal', [$mulai, $akhir]));
        }

        if ($request->filled('search')) {
            $kata = $request->search;
            $query->where(fn ($q) => $q
                ->whereHas('requester.user', fn ($u) => $u->whereLikeCi('nama', $kata))
                ->orWhereHas('substitute.user', fn ($u) => $u->whereLikeCi('nama', $kata)));
        }

        $perPage = $request->per_page === 'all' ? 1000 : (int) ($request->per_page ?: 25);
        $page    = $query->paginate($perPage);

        return response()->json([
            'data' => collect($page->items())->map(fn (SubstitutionRequest $r) => [
                'id'               => $r->uuid,
                'pengaju'          => $r->requester->user?->nama,
                'pengganti'        => $r->substitute->user?->nama,
                'status'           => $r->status->value,
                'status_label'     => $r->status->label(),
                'alasan'           => $r->alasan,
                'pesan'            => $r->pesan,
                'link_tugas'       => $r->link_tugas,
                'alasan_penolakan' => $r->alasan_penolakan,
                'diajukan_pada'    => $r->created_at->timezone(config('app.school_timezone'))->format('d/m/Y H:i'),
                'dijawab_pada'     => $r->responded_at?->timezone(config('app.school_timezone'))->format('d/m/Y H:i'),
                'jumlah_sesi'      => $r->sessions->count(),
                'sesi'             => $r->sessions->map(fn (SubstitutionSession $s) => [
                    'tanggal'     => $s->tanggal->toDateString(),
                    'jam_mulai'   => substr($s->schedule?->jam_mulai ?? '', 0, 5),
                    'jam_selesai' => substr($s->schedule?->jam_selesai ?? '', 0, 5),
                    'kelas'       => $s->schedule ? $this->service->labelKelas($s->schedule) : '—',
                    'mapel'       => $s->schedule?->subject?->nama,
                ])->values(),
            ]),
            'meta' => [
                'total'        => $page->total(),
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
            ],
            'ringkasan' => collect(SubstitutionStatus::cases())
                ->mapWithKeys(fn (SubstitutionStatus $s) => [
                    $s->value => SubstitutionRequest::where('status', $s)->count(),
                ]),
        ]);
    }
}
