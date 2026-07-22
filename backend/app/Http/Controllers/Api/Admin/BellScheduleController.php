<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BellDayDefault;
use App\Models\BellMode;
use App\Models\BellModeOverride;
use App\Models\BellPeriod;
use App\Support\BellSchedule;
use App\Traits\BuildsXlsxReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Panel Admin → Jam & Bel: bel per hari (jam ke- → pukul), mode waktu masuk
 * (Apel/Tanpa Apel sebagai pergeseran menit), default per hari, dan pengecualian
 * per tanggal. Resolusi pukul efektifnya ada di App\Support\BellSchedule.
 */
class BellScheduleController extends Controller
{
    use BuildsXlsxReports;

    private const HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

    // ── GET /admin/bell-schedule ─────────────────────────────────────────────
    public function show(): JsonResponse
    {
        return response()->json(['data' => [
            'periods' => BellPeriod::orderBy('jam_ke')->get()
                ->groupBy(fn ($p) => $p->hari->value)
                ->map(fn ($rows) => $rows->map(fn ($p) => [
                    'jam_ke'          => $p->jam_ke,
                    'jam_mulai'       => substr($p->jam_mulai, 0, 5),
                    'jam_selesai'     => substr($p->jam_selesai, 0, 5),
                    'is_istirahat'    => (bool) $p->is_istirahat,
                    'terkunci_offset' => (bool) $p->terkunci_offset,
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
            'hari'                        => ['required', Rule::in(self::HARI)],
            'periods'                     => ['present', 'array'],
            'periods.*.jam_ke'            => ['required', 'integer', 'min:0', 'max:20', 'distinct'],
            'periods.*.jam_mulai'         => ['required', 'date_format:H:i'],
            'periods.*.jam_selesai'       => ['required', 'date_format:H:i', 'after:periods.*.jam_mulai'],
            'periods.*.is_istirahat'      => ['sometimes', 'boolean'],
            'periods.*.terkunci_offset'   => ['sometimes', 'boolean'],
        ]);

        BellPeriod::where('hari', $data['hari'])->delete();
        foreach ($data['periods'] as $p) {
            BellPeriod::create([
                'hari'            => $data['hari'],
                'jam_ke'          => $p['jam_ke'],
                'jam_mulai'       => $p['jam_mulai'],
                'jam_selesai'     => $p['jam_selesai'],
                'is_istirahat'    => $p['is_istirahat'] ?? false,
                'terkunci_offset' => $p['terkunci_offset'] ?? false,
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

    // ── GET /admin/bell-schedule/template — template Excel jam bel ───────────
    public function template(): BinaryFileResponse
    {
        $headers = ['hari', 'jam_ke', 'jam_mulai', 'jam_selesai', 'is_istirahat', 'terkunci_offset'];
        // Baris contoh (bisa ditimpa admin) — hari valid + waktu HH:MM sebagai teks.
        // Kolom is_istirahat/terkunci_offset: isi "ya" bila periode itu istirahat / jam
        // dinding tetap saat mode menggeser awal hari (kosong = tidak).
        $example = [
            ['senin', 1, '07:00', '07:45', '', ''],
            ['senin', 2, '07:45', '08:30', '', ''],
            ['senin', 5, '10:00', '10:15', 'ya', 'ya'],
            ['jumat', 1, '07:00', '07:40', '', ''],
        ];

        $tempFile = tempnam(sys_get_temp_dir(), 'bel_tpl_');
        $writer   = new XlsxWriter();
        $writer->openToFile($tempFile);
        $writer->getOptions()->setColumnWidthForRange(20, 1, count($headers));

        $writer->addRow(Row::fromValuesWithStyle($headers, $this->xlsxHeaderStyle()));
        foreach ($example as $ex) {
            $writer->addRow(Row::fromValuesWithStyle($ex, $this->xlsxCellStyle()));
        }
        $writer->close();

        return response()->download($tempFile, 'template_jam_bel.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    // ── POST /admin/bell-schedule/import — impor jam bel dari Excel ──────────
    //
    // Format: hari | jam_ke | jam_mulai | jam_selesai (satu baris = satu jam bel).
    // MENGGANTI seluruh bel untuk setiap HARI yang muncul di file (hari yang tidak
    // ada di file tidak tersentuh) — supaya admin bisa impor sebagian hari saja.
    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls', 'max:2048']]);

        $rows    = $this->readXlsx($request->file('file')->getRealPath());
        $errors  = [];
        $perHari = [];   // hari => [ [jam_ke, jam_mulai, jam_selesai], ... ]

        foreach ($rows as $i => $row) {
            $rowNum      = $i + 2;
            $hari        = strtolower(trim((string) ($row[0] ?? '')));
            $jamKe       = trim((string) ($row[1] ?? ''));
            $jamMulai    = $this->normalizeTime($row[2] ?? '');
            $jamSelesai  = $this->normalizeTime($row[3] ?? '');
            $isIstirahat = $this->truthy($row[4] ?? '');
            $terkunci    = $this->truthy($row[5] ?? '');

            if (! in_array($hari, self::HARI, true)) {
                $errors[] = "Baris $rowNum: hari '$hari' tidak valid (senin–sabtu).";
                continue;
            }
            if (! is_numeric($jamKe) || (int) $jamKe < 0 || (int) $jamKe > 20) {
                $errors[] = "Baris $rowNum: jam_ke harus angka 0–20.";
                continue;
            }
            if (! $jamMulai || ! $jamSelesai) {
                $errors[] = "Baris $rowNum: jam_mulai/jam_selesai harus format HH:MM.";
                continue;
            }
            if ($jamSelesai <= $jamMulai) {
                $errors[] = "Baris $rowNum: jam_selesai harus setelah jam_mulai.";
                continue;
            }
            if (isset($perHari[$hari][(int) $jamKe])) {
                $errors[] = "Baris $rowNum: jam ke-$jamKe untuk $hari ganda di file.";
                continue;
            }

            $perHari[$hari][(int) $jamKe] = [
                'jam_ke'          => (int) $jamKe,
                'jam_mulai'       => $jamMulai,
                'jam_selesai'     => $jamSelesai,
                'is_istirahat'    => $isIstirahat,
                'terkunci_offset' => $terkunci,
            ];
        }

        if (empty($perHari)) {
            return response()->json([
                'message'      => 'Tidak ada baris valid untuk diimpor.',
                'imported'     => 0,
                'hari_count'   => 0,
                'error_count'  => count($errors),
                'errors'       => $errors,
            ], 422);
        }

        $imported = 0;
        foreach ($perHari as $hari => $periods) {
            BellPeriod::where('hari', $hari)->delete();
            foreach ($periods as $p) {
                BellPeriod::create(['hari' => $hari] + $p);
                $imported++;
            }
        }
        BellSchedule::flush();

        return response()->json([
            'message'     => "Berhasil mengimpor $imported jam bel untuk ".count($perHari).' hari.',
            'imported'    => $imported,
            'hari_count'  => count($perHari),
            'error_count' => count($errors),
            'errors'      => $errors,
        ]);
    }

    /** Sel boolean Excel: "ya"/"y"/"1"/"true"/"x"/"v" (case-insensitive) → true; selain itu false. */
    private function truthy(mixed $val): bool
    {
        return in_array(strtolower(trim((string) $val)), ['ya', 'y', '1', 'true', 'x', 'v', 'yes'], true);
    }

    /** Normalisasi nilai waktu dari sel Excel (string "07:00"/"7:00:00" atau serial waktu) → "H:i" atau null. */
    private function normalizeTime(mixed $val): ?string
    {
        if ($val instanceof \DateTimeInterface) {
            return $val->format('H:i');
        }

        $s = trim((string) $val);
        if ($s === '') {
            return null;
        }

        // Serial waktu Excel (pecahan hari, mis. 0.3125 = 07:30).
        if (is_numeric($s) && (float) $s >= 0 && (float) $s < 1) {
            $menit = (int) round((float) $s * 24 * 60);

            return sprintf('%02d:%02d', intdiv($menit, 60), $menit % 60);
        }

        // "07:00" atau "07:00:00" → ambil HH:MM, validasi rentang.
        if (preg_match('/^(\d{1,2}):(\d{2})(?::\d{2})?$/', $s, $m)) {
            $h = (int) $m[1];
            $i = (int) $m[2];
            if ($h <= 23 && $i <= 59) {
                return sprintf('%02d:%02d', $h, $i);
            }
        }

        return null;
    }

    /** Baca sheet pertama xlsx → array baris (tanpa header). */
    private function readXlsx(string $path): array
    {
        $reader = new XlsxReader();
        $reader->open($path);
        $rows       = [];
        $sheetCount = 0;

        foreach ($reader->getSheetIterator() as $sheet) {
            if ($sheetCount++ > 0) break;
            $firstRow = true;
            foreach ($sheet->getRowIterator() as $row) {
                if ($firstRow) { $firstRow = false; continue; }
                $values = $row->toArray();
                if (empty(array_filter($values, fn ($v) => $v !== '' && $v !== null))) continue;
                $rows[] = $values;
            }
        }
        $reader->close();

        return $rows;
    }
}
