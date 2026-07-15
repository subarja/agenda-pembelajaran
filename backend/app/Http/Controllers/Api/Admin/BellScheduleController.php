<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BellDayDefault;
use App\Models\BellMode;
use App\Models\BellModeOverride;
use App\Models\BellPeriod;
use App\Support\BellSchedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Panel Admin → Jam & Bel: bel per hari (jam ke- → pukul), mode waktu masuk
 * (Apel/Tanpa Apel sebagai pergeseran menit), default per hari, dan pengecualian
 * per tanggal. Resolusi pukul efektifnya ada di App\Support\BellSchedule.
 */
class BellScheduleController extends Controller
{
    private const HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

    // ── GET /admin/bell-schedule ─────────────────────────────────────────────
    public function show(): JsonResponse
    {
        return response()->json(['data' => [
            'periods' => BellPeriod::orderBy('jam_ke')->get()
                ->groupBy(fn ($p) => $p->hari->value)
                ->map(fn ($rows) => $rows->map(fn ($p) => [
                    'jam_ke'      => $p->jam_ke,
                    'jam_mulai'   => substr($p->jam_mulai, 0, 5),
                    'jam_selesai' => substr($p->jam_selesai, 0, 5),
                ])->values()),
            'modes' => BellMode::orderBy('id')->get()
                ->map(fn ($m) => [
                    'id'           => $m->id,
                    'nama'         => $m->nama,
                    'offset_menit' => $m->offset_menit,
                    'is_default'   => $m->is_default,
                ]),
            'day_defaults' => BellDayDefault::get()
                ->mapWithKeys(fn ($d) => [$d->hari->value => $d->bell_mode_id]),
            'overrides' => BellModeOverride::with('mode')->orderByDesc('tanggal')->limit(200)->get()
                ->map(fn ($o) => [
                    'id'         => $o->id,
                    'tanggal'    => $o->tanggal->toDateString(),
                    'mode_id'    => $o->bell_mode_id,
                    'mode_nama'  => $o->mode?->nama,
                    'keterangan' => $o->keterangan,
                ]),
        ]]);
    }

    // ── PUT /admin/bell-schedule/periods — ganti seluruh bel satu hari ───────
    public function updatePeriods(Request $request): JsonResponse
    {
        $data = $request->validate([
            'hari'                   => ['required', Rule::in(self::HARI)],
            'periods'                => ['present', 'array'],
            'periods.*.jam_ke'       => ['required', 'integer', 'min:0', 'max:20', 'distinct'],
            'periods.*.jam_mulai'    => ['required', 'date_format:H:i'],
            'periods.*.jam_selesai'  => ['required', 'date_format:H:i', 'after:periods.*.jam_mulai'],
        ]);

        BellPeriod::where('hari', $data['hari'])->delete();
        foreach ($data['periods'] as $p) {
            BellPeriod::create([
                'hari'        => $data['hari'],
                'jam_ke'      => $p['jam_ke'],
                'jam_mulai'   => $p['jam_mulai'],
                'jam_selesai' => $p['jam_selesai'],
            ]);
        }
        BellSchedule::flush();

        return response()->json(['message' => 'Jam bel hari '.ucfirst($data['hari']).' disimpan.']);
    }

    // ── POST /admin/bell-schedule/modes ──────────────────────────────────────
    public function storeMode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nama'         => ['required', 'string', 'max:50', 'unique:bell_modes,nama'],
            'offset_menit' => ['required', 'integer', 'min:-180', 'max:180'],
        ]);

        BellMode::create($data);
        BellSchedule::flush();

        return response()->json(['message' => "Mode {$data['nama']} ditambahkan."], 201);
    }

    // ── PUT /admin/bell-schedule/modes/{mode} ────────────────────────────────
    public function updateMode(Request $request, BellMode $mode): JsonResponse
    {
        $data = $request->validate([
            'nama'         => ['sometimes', 'string', 'max:50', Rule::unique('bell_modes', 'nama')->ignore($mode->id)],
            'offset_menit' => ['sometimes', 'integer', 'min:-180', 'max:180'],
            'is_default'   => ['sometimes', 'boolean'],
        ]);

        // Default global selalu tepat satu: menjadikan mode ini default otomatis
        // mencabut default dari mode lain; mencabut default TANPA pengganti ditolak.
        if (array_key_exists('is_default', $data)) {
            if (! $data['is_default'] && $mode->is_default) {
                return response()->json(['message' => 'Tetapkan mode lain sebagai default terlebih dahulu.'], 422);
            }
            if ($data['is_default']) {
                BellMode::where('id', '!=', $mode->id)->update(['is_default' => false]);
            }
        }

        $mode->update($data);
        BellSchedule::flush();

        return response()->json(['message' => "Mode {$mode->nama} diperbarui."]);
    }

    // ── DELETE /admin/bell-schedule/modes/{mode} ─────────────────────────────
    public function destroyMode(BellMode $mode): JsonResponse
    {
        if ($mode->is_default) {
            return response()->json(['message' => 'Mode default tidak bisa dihapus.'], 422);
        }

        // FK cascade ikut menghapus default-per-hari & pengecualian tanggal mode ini.
        $mode->delete();
        BellSchedule::flush();

        return response()->json(['message' => "Mode {$mode->nama} dihapus."]);
    }

    // ── PUT /admin/bell-schedule/day-defaults ────────────────────────────────
    public function updateDayDefaults(Request $request): JsonResponse
    {
        $data = $request->validate([
            'day_defaults'   => ['present', 'array'],
            'day_defaults.*' => ['nullable', 'integer', 'exists:bell_modes,id'],
        ]);

        foreach ($data['day_defaults'] as $hari => $modeId) {
            if (! in_array($hari, self::HARI, true)) {
                continue;
            }
            if ($modeId === null) {
                BellDayDefault::where('hari', $hari)->delete();
            } else {
                BellDayDefault::updateOrCreate(['hari' => $hari], ['bell_mode_id' => $modeId]);
            }
        }
        BellSchedule::flush();

        return response()->json(['message' => 'Mode default per hari disimpan.']);
    }

    // ── POST /admin/bell-schedule/overrides — bulk per tanggal ──────────────
    public function storeOverrides(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tanggal'      => ['required', 'array', 'min:1'],
            'tanggal.*'    => ['required', 'date_format:Y-m-d'],
            'bell_mode_id' => ['required', 'integer', 'exists:bell_modes,id'],
            'keterangan'   => ['nullable', 'string', 'max:255'],
        ]);

        foreach ($data['tanggal'] as $tanggal) {
            BellModeOverride::updateOrCreate(
                ['tanggal' => $tanggal],
                [
                    'bell_mode_id' => $data['bell_mode_id'],
                    'keterangan'   => $data['keterangan'] ?? null,
                    'created_by'   => $request->user()->id,
                ],
            );
        }
        BellSchedule::flush();

        $n = count($data['tanggal']);

        return response()->json(['message' => "Pengecualian untuk {$n} tanggal disimpan."], 201);
    }

    // ── DELETE /admin/bell-schedule/overrides/{override} ─────────────────────
    public function destroyOverride(BellModeOverride $override): JsonResponse
    {
        $override->delete();
        BellSchedule::flush();

        return response()->json(['message' => 'Pengecualian tanggal dihapus.']);
    }
}
