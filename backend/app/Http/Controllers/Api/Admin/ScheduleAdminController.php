<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\Hari;
use App\Http\Controllers\Controller;
use App\Models\Schedule;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\Teacher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScheduleAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // Daftar admin mengikuti TA aktif — sama seperti daftar Kelas. Jadwal TA lama
        // tetap tersimpan sebagai arsip dan terbaca lewat laporan semester lamanya.
        $query = Schedule::tahunAjaran()
            ->with(['schoolClass', 'subject', 'teacher.user'])
            ->when($request->class_id, fn ($q, $c) =>
                $q->whereHas('schoolClass', fn ($sc) => $sc->where('uuid', $c))
            )
            ->when($request->teacher_id, fn ($q, $t) =>
                $q->whereHas('teacher', fn ($tc) => $tc->where('uuid', $t))
            )
            ->when($request->hari, fn ($q, $h) => $q->where('hari', $h))
            ->when($request->search, fn ($q, $s) =>
                $q->where(fn ($inner) =>
                    $inner->whereLikeCi('hari', $s)
                          ->orWhereHas('subject', fn ($m) => $m->whereLikeCi('nama', $s)->orWhereLikeCi('kode', $s))
                          ->orWhereHas('teacher.user', fn ($u) => $u->whereLikeCi('nama', $s))
                          ->orWhereHas('teacher', fn ($t) => $t->whereLikeCi('nip', $s))
                          ->orWhereHas('schoolClass', fn ($sc) => $sc->whereLikeCi("CONCAT(tingkat, ' ', jurusan, ' - ', rombel)", $s))
                )
            )
            ->orderByRaw("CASE hari WHEN 'senin' THEN 1 WHEN 'selasa' THEN 2 WHEN 'rabu' THEN 3 WHEN 'kamis' THEN 4 WHEN 'jumat' THEN 5 WHEN 'sabtu' THEN 6 END")
            ->orderBy('jam_mulai');

        $perPageRaw = $request->get('per_page', 25);
        if ($perPageRaw === 'all') {
            $items = $query->get();
            $n     = $items->count();
            return response()->json([
                'data' => $items->map(fn ($s) => $this->format($s)),
                'meta' => ['total' => $n, 'current_page' => 1, 'last_page' => 1, 'per_page' => $n ?: 1],
            ]);
        }

        $paginator = $query->paginate(min((int) $perPageRaw, 1000));
        return response()->json([
            'data' => $paginator->map(fn ($s) => $this->format($s)),
            'meta' => [
                'total'        => $paginator->total(),
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'class_id'   => ['required', 'string'],
            'subject_id' => ['required', 'string'],
            'teacher_id' => ['required', 'string'],
            'hari'       => ['required', 'in:senin,selasa,rabu,kamis,jumat,sabtu'],
            'jam_mulai'  => ['required', 'date_format:H:i'],
            'jam_selesai'=> ['required', 'date_format:H:i', 'after:jam_mulai'],
            'aktif'      => ['boolean'],
        ]);

        $class   = SchoolClass::where('uuid', $data['class_id'])->firstOrFail();
        $subject = Subject::where('uuid', $data['subject_id'])->firstOrFail();
        $teacher = Teacher::where('uuid', $data['teacher_id'])->firstOrFail();

        abort_if(
            Schedule::where('class_id', $class->id)->where('hari', $data['hari'])->where('jam_mulai', $data['jam_mulai'])->exists(),
            422, 'Kelas sudah memiliki jadwal pada hari dan jam yang sama.'
        );

        $schedule = Schedule::create([
            'class_id'    => $class->id,
            'subject_id'  => $subject->id,
            'teacher_id'  => $teacher->id,
            'hari'        => Hari::from($data['hari']),
            'jam_mulai'   => $data['jam_mulai'],
            'jam_selesai' => $data['jam_selesai'],
            'aktif'       => $data['aktif'] ?? true,
        ]);

        return response()->json(['message' => 'Jadwal berhasil dibuat.', 'data' => $this->format($schedule->load(['schoolClass', 'subject', 'teacher.user']))], 201);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $schedule = Schedule::where('uuid', $uuid)->firstOrFail();
        $data     = $request->validate([
            'teacher_id'  => ['sometimes', 'string'],
            'hari'        => ['sometimes', 'in:senin,selasa,rabu,kamis,jumat,sabtu'],
            'jam_mulai'   => ['sometimes', 'date_format:H:i'],
            'jam_selesai' => ['sometimes', 'date_format:H:i'],
            'aktif'       => ['sometimes', 'boolean'],
        ]);

        $fields = [];
        if (isset($data['teacher_id'])) $fields['teacher_id'] = Teacher::where('uuid', $data['teacher_id'])->value('id');
        if (isset($data['hari']))       $fields['hari']       = Hari::from($data['hari']);
        if (isset($data['jam_mulai']))  $fields['jam_mulai']  = $data['jam_mulai'];
        if (isset($data['jam_selesai']))$fields['jam_selesai']= $data['jam_selesai'];
        if (isset($data['aktif']))      $fields['aktif']      = $data['aktif'];

        $schedule->update($fields);

        return response()->json(['message' => 'Jadwal diperbarui.', 'data' => $this->format($schedule->fresh(['schoolClass', 'subject', 'teacher.user']))]);
    }

    public function destroy(string $uuid): JsonResponse
    {
        $schedule = Schedule::where('uuid', $uuid)->firstOrFail();
        abort_if($schedule->agendas()->count() > 0, 422, 'Jadwal sudah memiliki riwayat agenda.');
        $schedule->delete();

        return response()->json(['message' => 'Jadwal dihapus.']);
    }

    private function format(Schedule $s): array
    {
        // Relasi di-guard null: data hasil import bisa punya relasi yatim (kelas/mapel/
        // guru terhapus), dan tanpa guard `$s->schoolClass->tingkat->value` melempar
        // "Attempt to read property on null" → 500 yang bikin tabel jadwal gagal dimuat.
        $class   = $s->schoolClass;
        $subject = $s->subject;
        $teacher = $s->teacher;

        return [
            'id'         => $s->uuid,
            'hari'       => $s->hari->value,
            'jam_mulai'  => substr($s->jam_mulai, 0, 5),
            'jam_selesai'=> substr($s->jam_selesai, 0, 5),
            'aktif'      => $s->aktif,
            'kelas'      => $class
                ? ['id' => $class->uuid, 'label' => $class->tingkat->value . ' ' . $class->jurusan . ' - ' . $class->rombel]
                : ['id' => '', 'label' => '— (kelas terhapus)'],
            'mapel'      => $subject
                ? ['id' => $subject->uuid, 'nama' => $subject->nama]
                : ['id' => '', 'nama' => '— (mapel terhapus)'],
            'guru'       => $teacher
                ? ['id' => $teacher->uuid, 'nama' => $teacher->user?->nama ?? '— (akun guru terhapus)']
                : ['id' => '', 'nama' => '— (guru terhapus)'],
        ];
    }
}
