<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Enums\CharacterSign;
use App\Enums\CharacterSifat;
use App\Models\CharacterCategory;
use App\Models\CharacterInput;
use App\Models\CharacterSubitem;
use App\Models\Student;
use App\Services\CharacterService;
use App\Support\ClassAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CharacterController extends Controller
{
    // GET /character-categories — semua kategori aktif + subitems
    public function categories(): JsonResponse
    {
        $categories = CharacterCategory::where('aktif', true)
            ->with(['subitems' => fn ($q) => $q->where('aktif', true)->orderBy('bobot', 'desc')])
            ->orderBy('nama')
            ->get()
            ->map(fn ($cat) => [
                'id'       => $cat->uuid,
                'nama'     => $cat->nama,
                'subitems' => $cat->subitems->map(fn ($s) => [
                    'id'        => $s->uuid,
                    'kode'      => $s->kode,
                    'deskripsi' => $s->deskripsi,
                    'bobot'     => $s->bobot,
                    'sifat'     => $s->sifat->value,
                ]),
            ]);

        return response()->json(['data' => $categories]);
    }

    // POST /character-inputs
    public function storeInput(Request $request): JsonResponse
    {
        $data = $request->validate([
            'student_id' => ['required', 'string'],
            'subitem_id' => ['required', 'string'],
            'sign'       => ['nullable', 'in:positif,negatif'],
            'catatan'    => ['nullable', 'string', 'max:500'],
            'agenda_id'  => ['nullable', 'string'],
        ]);

        $student = Student::where('uuid', $data['student_id'])->firstOrFail();
        $subitem  = CharacterSubitem::where('uuid', $data['subitem_id'])->firstOrFail();
        $teacher  = $request->user()->teacher;

        abort_if(! $teacher, 403, 'Hanya guru yang dapat memberi penilaian karakter.');

        // Tentukan sign dari sifat subitem
        $sign = match ($subitem->sifat) {
            CharacterSifat::Positif  => CharacterSign::Positif,
            CharacterSifat::Negatif  => CharacterSign::Negatif,
            CharacterSifat::Keduanya => CharacterSign::from($data['sign'] ?? 'positif'),
        };

        $agendaId = null;
        if (! empty($data['agenda_id'])) {
            $agenda = \App\Models\Agenda::where('uuid', $data['agenda_id'])->first();
            $agendaId = $agenda?->id;
        }

        $input = CharacterInput::create([
            'student_id' => $student->id,
            'subitem_id' => $subitem->id,
            'teacher_id' => $teacher->id,
            'agenda_id'  => $agendaId,
            'sign'       => $sign,
            'catatan'    => $data['catatan'] ?? null,
        ]);

        // Hitung ulang akumulasi, cek ambang, update EWS
        app(CharacterService::class)->processAfterInput($student->load('schoolClass'));

        $poin = $sign === CharacterSign::Positif ? abs($subitem->bobot) : -abs($subitem->bobot);

        return response()->json([
            'message' => "Penilaian karakter disimpan. {$student->user->nama} mendapat {$poin} poin.",
            'data'    => [
                'id'         => $input->id,
                'student'    => $student->user->nama,
                'subitem'    => $subitem->deskripsi,
                'poin'       => $poin,
                'sign'       => $sign->value,
                'created_at' => $input->created_at->toISOString(),
            ],
        ], 201);
    }

    // GET /character-inputs?student_id=xxx&limit=20
    public function indexInputs(Request $request): JsonResponse
    {
        $request->validate([
            'student_id' => ['required', 'string'],
        ]);

        $student = Student::where('uuid', $request->student_id)->firstOrFail();

        // Sama seperti summary(): tanpa penjagaan ini, akun siswa bisa membaca riwayat
        // pelanggaran siswa lain lengkap dengan catatan dan nama guru pencatatnya.
        $user = $request->user();
        if (ClassAccess::isStudentSide($user)) {
            abort_unless(ClassAccess::isOwnStudent($user, $student), 403, 'Akses ditolak.');
        }

        $inputs = CharacterInput::where('student_id', $student->id)
            ->with(['subitem.category', 'teacher.user'])
            ->orderByDesc('created_at')
            ->limit((int) $request->get('limit', 20))
            ->get()
            ->map(fn ($i) => [
                'id'        => $i->id,
                'kategori'  => $i->subitem->category->nama,
                'subitem'   => $i->subitem->deskripsi,
                'poin'      => $i->sign->value === 'positif'
                                ? abs($i->subitem->bobot)
                                : -abs($i->subitem->bobot),
                'sign'      => $i->sign->value,
                'catatan'   => $i->catatan,
                'guru'      => $i->teacher->user->nama,
                'tanggal'   => $i->created_at->format('Y-m-d H:i'),
            ]);

        return response()->json(['data' => $inputs]);
    }

    // GET /character-summary?student_id=xxx
    public function summary(Request $request): JsonResponse
    {
        $request->validate([
            'student_id' => ['required', 'string'],
        ]);

        $student = Student::where('uuid', $request->student_id)
            ->with('user')
            ->firstOrFail();

        // Endpoint ini dulu tanpa otorisasi: akun siswa bisa membaca nama, NIS, dan total
        // poin karakter siswa lain (audit 2026-07-09). Seluruh guru tetap boleh — mereka
        // butuh konteks poin berjalan saat memberi apresiasi/pelanggaran, dan itu memang
        // inti prinsip "karakter sebagai aset kolektif".
        $user = $request->user();
        if (ClassAccess::isStudentSide($user)) {
            abort_unless(ClassAccess::isOwnStudent($user, $student), 403, 'Akses ditolak.');
        }

        $inputs = CharacterInput::where('student_id', $student->id)
            ->with('subitem.category')
            ->get();

        $total = $inputs->sum(fn ($i) =>
            $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot)
        );

        $perKategori = $inputs->groupBy(fn ($i) => $i->subitem->category->nama)
            ->map(fn ($group, $nama) => [
                'nama'  => $nama,
                'total' => $group->sum(fn ($i) =>
                    $i->sign->value === 'positif' ? abs($i->subitem->bobot) : -abs($i->subitem->bobot)
                ),
                'count' => $group->count(),
            ])
            ->values();

        return response()->json([
            'data' => [
                'student'      => ['id' => $student->uuid, 'nama' => $student->user->nama, 'nis' => $student->nis],
                'total_poin'   => $total,
                'per_kategori' => $perKategori,
                'total_input'  => $inputs->count(),
            ],
        ]);
    }
}
