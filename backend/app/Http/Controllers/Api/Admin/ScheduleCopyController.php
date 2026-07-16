<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\Schedule;
use App\Models\SchoolClass;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * "Salin Jadwal dari semester lain" — untuk pergantian semester yang jadwalnya tidak
 * (banyak) berubah, khususnya ganjil → genap. Jadwal TA sumber disalin ke kelas
 * PADANANNYA di TA aktif (tingkat + jurusan + rombel sama), guru & mapel tetap.
 *
 * Upsert per (kelas, hari, jam_mulai) — pola yang sama dengan impor aSc XML — sehingga
 * aman dijalankan ulang dan aman dikombinasikan dengan impor: tidak pernah menduplikat.
 * Kelas TA aktif yang tidak punya padanan di sumber dilewati (dilaporkan), begitu juga
 * sebaliknya. Setelah menyalin, revisi kecil bisa dilakukan manual di tab Jadwal.
 */
class ScheduleCopyController extends Controller
{
    // GET /admin/schedules/copy-preview?source_academic_year_id=<uuid>
    public function preview(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        [$source, $active] = $this->resolveYears($request);

        $map = $this->classPairs($source, $active);

        return response()->json(['data' => [
            'source'         => ['id' => $source->uuid, 'label' => "{$source->tahun} " . ucfirst($source->semester->value)],
            'target'         => ['id' => $active->uuid, 'label' => "{$active->tahun} " . ucfirst($active->semester->value)],
            'jumlah_jadwal'  => Schedule::whereIn('class_id', $map['pairs']->keys())->where('aktif', true)->count(),
            'kelas_cocok'    => $map['pairs']->count(),
            'tanpa_padanan'  => $map['unmatched']->values(),
        ]]);
    }

    // POST /admin/schedules/copy-from  body: { source_academic_year_id }
    public function copy(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        [$source, $active] = $this->resolveYears($request);

        $map   = $this->classPairs($source, $active);
        $pairs = $map['pairs'];

        $stats = DB::transaction(function () use ($pairs, $request) {
            $created = 0; $updated = 0;

            $schedules = Schedule::whereIn('class_id', $pairs->keys())->where('aktif', true)->get();

            foreach ($schedules as $s) {
                $targetClassId = $pairs[$s->class_id];

                $existing = Schedule::withTrashed()->where([
                    'class_id'  => $targetClassId,
                    'hari'      => $s->hari->value,
                    'jam_mulai' => $s->jam_mulai,
                ])->first();

                if ($existing) {
                    if ($existing->trashed()) $existing->restore();
                    $existing->update([
                        'subject_id'  => $s->subject_id,
                        'teacher_id'  => $s->teacher_id,
                        'jam_selesai' => $s->jam_selesai,
                        'aktif'       => true,
                        'updated_by'  => $request->user()->id,
                    ]);
                    $updated++;
                } else {
                    Schedule::create([
                        'class_id'    => $targetClassId,
                        'subject_id'  => $s->subject_id,
                        'teacher_id'  => $s->teacher_id,
                        'hari'        => $s->hari->value,
                        'jam_mulai'   => $s->jam_mulai,
                        'jam_selesai' => $s->jam_selesai,
                        'aktif'       => true,
                        'created_by'  => $request->user()->id,
                    ]);
                    $created++;
                }
            }

            return compact('created', 'updated');
        });

        $skipMsg = $map['unmatched']->isNotEmpty()
            ? ' Kelas tanpa padanan (dilewati): ' . $map['unmatched']->join(', ') . '.'
            : '';

        return response()->json([
            'message' => "Salin jadwal selesai: {$stats['created']} dibuat, {$stats['updated']} diperbarui.{$skipMsg}",
            'data'    => $stats + ['tanpa_padanan' => $map['unmatched']->values()],
        ]);
    }

    /**
     * Peta class_id sumber → class_id TA aktif, dipasangkan lewat tingkat+jurusan+rombel.
     *
     * @return array{pairs: \Illuminate\Support\Collection, unmatched: \Illuminate\Support\Collection}
     */
    private function classPairs(AcademicYear $source, AcademicYear $active): array
    {
        $key = fn ($c) => "{$c->tingkat->value}|{$c->jurusan}|{$c->rombel}";

        $targetByKey = SchoolClass::where('academic_year_id', $active->id)->get()->keyBy($key);

        $pairs = collect();
        $unmatched = collect();
        foreach (SchoolClass::where('academic_year_id', $source->id)->get() as $c) {
            $t = $targetByKey->get($key($c));
            if ($t) {
                $pairs[$c->id] = $t->id;
            } else {
                $unmatched->push("{$c->tingkat->value} {$c->jurusan} - {$c->rombel}");
            }
        }

        return ['pairs' => $pairs, 'unmatched' => $unmatched];
    }

    /** @return array{0: AcademicYear, 1: AcademicYear} — [sumber, TA aktif (tujuan)] */
    private function resolveYears(Request $request): array
    {
        $request->validate(['source_academic_year_id' => ['required', 'string']]);

        $active = \App\Support\TahunAjaran::current();
        abort_if(! $active, 422, 'Tidak ada tahun ajaran aktif sebagai tujuan.');

        $source = AcademicYear::where('uuid', $request->source_academic_year_id)->first();
        abort_if(! $source, 404, 'Tahun ajaran sumber tidak ditemukan.');
        abort_if($source->id === $active->id, 422, 'Tahun ajaran sumber harus berbeda dari tahun ajaran aktif.');

        return [$source, $active];
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()->role === UserRole::Admin, 403, 'Hanya admin yang dapat menyalin jadwal.');
    }
}
