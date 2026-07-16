<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\CalendarEvent;
use App\Models\CalendarSetting;
use App\Models\NonEffectiveDay;
use App\Services\GoogleApiKeyCalendarService;
use App\Services\GoogleCalendarService;
use App\Services\IcsCalendarService;
use App\Traits\BuildsXlsxReports;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class CalendarController extends Controller
{
    use BuildsXlsxReports;

    // ── GET /admin/calendar/settings ─────────────────────────────────────────
    public function getSettings(): JsonResponse
    {
        $s = CalendarSetting::instance();

        return response()->json([
            'sync_method' => $s->sync_method ?? 'ics',
            'ics_url' => $s->ics_url,
            'api_key' => $s->api_key,
            'calendar_id' => $s->calendar_id,
            'has_credentials' => ! empty($s->service_account_json),
            'last_synced_at' => $s->last_synced_at?->format('Y-m-d H:i'),
            'sync_months_ahead' => $s->sync_months_ahead,
        ]);
    }

    // ── POST /admin/calendar/settings ────────────────────────────────────────
    public function saveSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sync_method' => ['sometimes', 'in:ics,api_key,service_account'],
            'ics_url' => ['sometimes', 'nullable', 'url'],
            'api_key' => ['sometimes', 'nullable', 'string', 'max:200'],
            'calendar_id' => ['sometimes', 'nullable', 'string'],
            'sync_months_ahead' => ['sometimes', 'integer', 'min:1', 'max:24'],
        ]);

        // calendar_id is NOT NULL in DB — convert null to empty string
        if (array_key_exists('calendar_id', $data) && $data['calendar_id'] === null) {
            $data['calendar_id'] = '';
        }

        CalendarSetting::instance()->update($data);

        return response()->json(['message' => 'Pengaturan kalender berhasil disimpan.']);
    }

    // ── POST /admin/calendar/upload-credentials ───────────────────────────────
    public function uploadCredentials(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:json', 'max:512'],
        ]);

        $json = file_get_contents($request->file('file')->getRealPath());
        $decoded = json_decode($json, true);

        if (! isset($decoded['type']) || $decoded['type'] !== 'service_account') {
            return response()->json(['message' => 'File bukan service account JSON yang valid.'], 422);
        }

        CalendarSetting::instance()->update(['service_account_json' => $json]);

        return response()->json([
            'message' => 'Service account berhasil disimpan.',
            'client_email' => $decoded['client_email'] ?? '',
        ]);
    }

    // ── POST /admin/calendar/sync ─────────────────────────────────────────────
    public function sync(Request $request): JsonResponse
    {
        try {
            $setting = CalendarSetting::instance();
            if ($setting->useIcs()) {
                $result = app(IcsCalendarService::class)->sync();
            } elseif ($setting->useApiKey()) {
                $result = app(GoogleApiKeyCalendarService::class)->sync();
            } else {
                $result = app(GoogleCalendarService::class)->sync();
            }

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // ── GET /admin/calendar/events?from=&to= ─────────────────────────────────
    // Dipakai juga oleh guru (non-admin route)
    public function events(Request $request): JsonResponse
    {
        $from = $request->get('from', Carbon::now()->startOfMonth()->toDateString());
        $to = $request->get('to', Carbon::now()->endOfMonth()->toDateString());

        $events = CalendarEvent::where('start_date', '<=', $to)
            ->where('end_date', '>=', $from)
            ->orderBy('start_date')
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'title' => $e->title,
                'description' => $e->description,
                'start_date' => $e->start_date->format('Y-m-d'),
                'end_date' => $e->end_date->format('Y-m-d'),
                'color' => $e->color,
                'all_day' => $e->all_day,
                'source' => $e->source,
            ]);

        $nonEffective = NonEffectiveDay::whereBetween('tanggal', [$from, $to])
            ->with('calendarEvent')
            ->orderBy('tanggal')
            ->get()
            ->map(fn ($n) => [
                'id' => $n->id,
                'tanggal' => $n->tanggal->format('Y-m-d'),
                'status' => $n->status,
                'keterangan' => $n->keterangan,
                'event_title' => $n->calendarEvent?->title,
            ]);

        return response()->json([
            'events' => $events,
            'non_effective' => $nonEffective,
            'last_synced' => CalendarSetting::instance()->last_synced_at?->format('Y-m-d H:i'),
        ]);
    }

    // ── GET /admin/non-effective-days ─────────────────────────────────────────
    public function listNonEffective(Request $request): JsonResponse
    {
        $year = $request->get('year', Carbon::now()->year);
        $month = $request->get('month', null);

        $query = NonEffectiveDay::with('calendarEvent')
            ->whereYear('tanggal', $year);

        if ($month) {
            $query->whereMonth('tanggal', $month);
        }

        $days = $query->orderBy('tanggal')->get()->map(fn ($n) => [
            'id' => $n->id,
            'tanggal' => $n->tanggal->format('Y-m-d'),
            'status' => $n->status,
            'keterangan' => $n->keterangan,
            'event_title' => $n->calendarEvent?->title,
        ]);

        return response()->json(['data' => $days]);
    }

    // Sabtu/Minggu tidak pernah dihitung sebagai hari efektif ataupun tidak efektif,
    // jadi tidak boleh ditandai tidak_efektif sama sekali (manual, import, maupun auto-mark).
    private function isWeekendDate(string $tanggal): bool
    {
        return in_array(Carbon::parse($tanggal)->dayOfWeek, [Carbon::SATURDAY, Carbon::SUNDAY], true);
    }

    // ── POST /admin/non-effective-days ────────────────────────────────────────
    public function storeNonEffective(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tanggal' => [
                'required', 'date', 'unique:non_effective_days,tanggal',
                function ($attribute, $value, $fail) {
                    if ($this->isWeekendDate($value)) {
                        $fail('Sabtu dan Minggu tidak dihitung sebagai hari efektif/tidak efektif, tidak perlu ditandai.');
                    }
                },
            ],
            'keterangan' => ['nullable', 'string', 'max:255'],
        ]);

        $ned = NonEffectiveDay::create([
            ...$data,
            'status' => 'tidak_efektif',
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Hari tidak efektif berhasil ditambahkan.',
            'data' => ['id' => $ned->id, 'tanggal' => $ned->tanggal->format('Y-m-d'), 'status' => $ned->status, 'keterangan' => $ned->keterangan],
        ], 201);
    }

    // ── PUT /admin/non-effective-days/{id} ────────────────────────────────────
    public function updateNonEffective(Request $request, int $id): JsonResponse
    {
        $ned = NonEffectiveDay::findOrFail($id);

        $data = $request->validate([
            'tanggal' => [
                'sometimes', 'date', "unique:non_effective_days,tanggal,{$id}",
                function ($attribute, $value, $fail) {
                    if ($this->isWeekendDate($value)) {
                        $fail('Sabtu dan Minggu tidak dihitung sebagai hari efektif/tidak efektif, tidak perlu ditandai.');
                    }
                },
            ],
            'keterangan' => ['nullable', 'string', 'max:255'],
        ]);

        $ned->update([...$data, 'updated_by' => $request->user()->id]);

        return response()->json(['message' => 'Berhasil diperbarui.']);
    }

    // ── DELETE /admin/non-effective-days/{id} ─────────────────────────────────
    public function deleteNonEffective(int $id): JsonResponse
    {
        NonEffectiveDay::findOrFail($id)->delete();

        return response()->json(['message' => 'Berhasil dihapus.']);
    }

    // ── POST /admin/non-effective-days/bulk ────────────────────────────────────
    // Terapkan SATU status (efektif ATAU tidak_efektif) ke banyak tanggal sekaligus —
    // tidak bisa mencampur dua status berbeda dalam satu batch, karena hanya ada satu
    // parameter `status` untuk seluruh daftar tanggal.
    public function bulkNonEffective(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tanggal' => ['required', 'array', 'min:1'],
            'tanggal.*' => ['date'],
            'status' => ['required', 'in:efektif,tidak_efektif'],
            'keterangan' => ['nullable', 'string', 'max:255'],
        ]);

        $userId = $request->user()->id;
        $marked = 0;
        $reverted = 0;
        $skippedWeekend = 0;

        foreach ($data['tanggal'] as $tanggalRaw) {
            $tanggal = Carbon::parse($tanggalRaw)->format('Y-m-d');

            if ($this->isWeekendDate($tanggal)) {
                $skippedWeekend++;

                continue;
            }

            $existing = NonEffectiveDay::where('tanggal', $tanggal)->first();

            if ($data['status'] === 'efektif') {
                if ($existing) {
                    $existing->delete();
                    $reverted++;
                }
            } else {
                if ($existing) {
                    $existing->update([
                        'keterangan' => $data['keterangan'] ?? $existing->keterangan,
                        'updated_by' => $userId,
                    ]);
                } else {
                    NonEffectiveDay::create([
                        'tanggal' => $tanggal,
                        'status' => 'tidak_efektif',
                        'keterangan' => $data['keterangan'] ?? null,
                        'created_by' => $userId,
                        'updated_by' => $userId,
                    ]);
                }
                $marked++;
            }
        }

        $message = $data['status'] === 'efektif'
            ? "{$reverted} tanggal dikembalikan menjadi efektif."
            : "{$marked} tanggal ditandai tidak efektif.";
        if ($skippedWeekend > 0) {
            $message .= " ({$skippedWeekend} tanggal akhir pekan dilewati — Sabtu/Minggu tidak dihitung.)";
        }

        return response()->json([
            'message' => $message,
            'marked' => $marked,
            'reverted' => $reverted,
            'skipped_weekend' => $skippedWeekend,
        ]);
    }

    // ── POST /admin/non-effective-days/import ─────────────────────────────────
    public function importNonEffective(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120'],
        ]);

        $reader = new XlsxReader;
        $reader->open($request->file('file')->getRealPath());

        $inserted = 0;
        $updated = 0;
        $reverted = 0;
        $errors = [];
        $userId = $request->user()->id;
        $rowNum = 0;

        foreach ($reader->getSheetIterator() as $sheet) {
            foreach ($sheet->getRowIterator() as $row) {
                $rowNum++;
                if ($rowNum === 1) {
                    continue;
                }

                $values = $row->toArray();
                $tanggalRaw = trim((string) ($values[0] ?? ''));
                $status = strtolower(trim((string) ($values[1] ?? '')));
                $keterangan = trim((string) ($values[2] ?? ''));

                if ($tanggalRaw === '') {
                    continue;
                }

                try {
                    $tanggal = Carbon::parse($tanggalRaw)->format('Y-m-d');
                } catch (\Exception) {
                    $errors[] = "Baris {$rowNum}: format tanggal '{$tanggalRaw}' tidak valid.";

                    continue;
                }

                // Sabtu/Minggu tidak dihitung sebagai hari efektif ataupun tidak efektif —
                // dilewati tanpa dianggap error supaya tidak mengganggu import baris lain.
                if ($this->isWeekendDate($tanggal)) {
                    continue;
                }

                // "efektif" — tanggal ini TETAP hari efektif walau ada event kalender di
                // situ. Hapus penanda tidak_efektif kalau sebelumnya sempat ada.
                if ($status === 'efektif') {
                    $existing = NonEffectiveDay::where('tanggal', $tanggal)->first();
                    if ($existing) {
                        $existing->delete();
                        $reverted++;
                    }

                    continue;
                }

                // Accept lama (libur/daring/lainnya) maupun baru (tidak_efektif) — semua masuk sebagai tidak_efektif
                if ($status !== '' && ! in_array($status, ['libur', 'daring', 'lainnya', 'tidak_efektif'])) {
                    $errors[] = "Baris {$rowNum}: status '{$status}' tidak valid.";

                    continue;
                }
                $status = 'tidak_efektif'; // normalize

                $existing = NonEffectiveDay::where('tanggal', $tanggal)->first();
                if ($existing) {
                    $existing->update(['status' => $status, 'keterangan' => $keterangan ?: $existing->keterangan, 'updated_by' => $userId]);
                    $updated++;
                } else {
                    NonEffectiveDay::create(['tanggal' => $tanggal, 'status' => $status, 'keterangan' => $keterangan ?: null, 'created_by' => $userId, 'updated_by' => $userId]);
                    $inserted++;
                }
            }
            break;
        }
        $reader->close();

        return response()->json([
            'message' => "Import selesai: {$inserted} ditambahkan, {$updated} diperbarui, {$reverted} dikembalikan efektif.",
            'inserted' => $inserted, 'updated' => $updated, 'reverted' => $reverted, 'errors' => $errors,
        ]);
    }

    /**
     * GET /admin/non-effective-days/unmarked-count
     *
     * Berapa hari kerja dari acara kalender yang BELUM tercatat sebagai hari tidak efektif,
     * DIPISAH antara yang jatuh di dalam semester aktif dan yang di luarnya.
     *
     * Dua jebakan yang dijawab endpoint ini, keduanya ditemukan pada audit 2026-07-09:
     *
     * 1. Menyinkronkan kalender tidak menulis apa pun ke non_effective_days (admin berhak
     *    menolak sebagian acara), tapi layar tidak pernah mengatakannya — admin mengira
     *    hari efektif guru sudah berkurang.
     * 2. EffectiveDayService hanya menghitung tanggal DI DALAM rentang semester aktif.
     *    Kalender sekolah yang berisi libur semester berikutnya bisa menghasilkan puluhan
     *    hari tertandai yang sama sekali tidak mengubah angka guru — persis kondisi yang
     *    membuat "penandaan admin tidak sampai ke guru" terlihat seperti bug.
     */
    public function unmarkedCount(): JsonResponse
    {
        $marked = NonEffectiveDay::pluck('tanggal')
            ->map(fn ($t) => Carbon::parse($t)->toDateString())
            ->flip();

        $ay = \App\Support\TahunAjaran::current();

        // Tanggal dikumpulkan sebagai himpunan, bukan dihitung di dalam loop: dua acara
        // yang saling bertumpang tindih (mis. "Libur Semester" dan "Rapat Kelulusan" di
        // hari yang sama) hanya menghasilkan SATU hari tidak efektif, dan angka di layar
        // harus cocok dengan jumlah yang benar-benar akan dibuat oleh auto-mark.
        $belum = collect();

        foreach (CalendarEvent::all() as $ev) {
            $cur = $ev->start_date->copy();

            while ($cur->lte($ev->end_date)) {
                $tanggal = $cur->toDateString();

                if (! $this->isWeekendDate($tanggal) && ! $marked->has($tanggal)) {
                    $belum->push($tanggal);
                }

                $cur->addDay();
            }
        }

        $belum = $belum->unique();

        // Tanggal semester nullable (admin bisa belum mengisinya) — tanpa rentang,
        // tidak ada satu pun tanggal yang bisa disebut "dalam semester".
        $dalamSemester = ($ay && $ay->tanggal_mulai && $ay->tanggal_selesai)
            ? $belum->filter(fn ($t) => Carbon::parse($t)->betweenIncluded($ay->tanggal_mulai, $ay->tanggal_selesai))
            : collect();

        return response()->json(['data' => [
            'belum_ditandai'    => $dalamSemester->count(),
            'di_luar_semester'  => $belum->count() - $dalamSemester->count(),
            'semester_label'    => $ay ? "{$ay->tahun} {$ay->semester->value}" : null,
            'semester_mulai'    => $ay?->tanggal_mulai?->toDateString(),
            'semester_selesai'  => $ay?->tanggal_selesai?->toDateString(),
        ]]);
    }

    // ── POST /admin/non-effective-days/auto-mark ──────────────────────────────
    // Tandai SEMUA event kalender yang belum ada di non_effective_days
    public function autoMarkFromEvents(Request $request): JsonResponse
    {
        $data = ['status' => 'tidak_efektif'];

        $events = CalendarEvent::orderBy('start_date')->get();
        $userId = $request->user()->id;
        $created = 0;
        $skipped = 0;

        foreach ($events as $ev) {
            // Untuk event multi-hari, tandai setiap tanggal
            $cur = $ev->start_date->copy();
            $end = $ev->end_date->copy();

            while ($cur->lte($end)) {
                $tanggal = $cur->toDateString();

                if ($this->isWeekendDate($tanggal)) {
                    $cur->addDay();

                    continue;
                }

                $existing = NonEffectiveDay::where('tanggal', $tanggal)->exists();

                if (! $existing) {
                    NonEffectiveDay::create([
                        'tanggal' => $tanggal,
                        'status' => $data['status'],
                        'keterangan' => $ev->title,
                        'calendar_event_id' => $ev->id,
                        'created_by' => $userId,
                        'updated_by' => $userId,
                    ]);
                    $created++;
                } else {
                    $skipped++;
                }

                $cur->addDay();
            }
        }

        return response()->json([
            'message' => "Selesai: {$created} hari ditandai, {$skipped} sudah ada sebelumnya.",
            'created' => $created,
            'skipped' => $skipped,
        ]);
    }

    // ── GET /admin/non-effective-days/template ────────────────────────────────
    public function templateNonEffective(Request $request): BinaryFileResponse
    {
        $year = $request->get('year', Carbon::now()->year);
        $month = $request->get('month', null); // null = seluruh tahun

        if ($month) {
            $from = Carbon::create($year, $month)->startOfMonth();
            $to = $from->copy()->endOfMonth();
        } else {
            $from = Carbon::create($year, 1)->startOfYear();
            $to = $from->copy()->endOfYear();
        }

        // Ambil event kalender yang overlap rentang ini
        $calEvents = CalendarEvent::where('start_date', '<=', $to->toDateString())
            ->where('end_date', '>=', $from->toDateString())
            ->orderBy('start_date')
            ->get();

        // Pecah setiap event multi-hari jadi satu tanggal per baris (dibatasi rentang
        // from-to) — sebelumnya cuma start_date event yang muncul, tanggal-tanggal
        // lain dalam rentang event hilang dari template.
        $eventByDate = [];
        foreach ($calEvents as $ev) {
            // PENTING: max()/min() mengembalikan objek argumennya APA ADANYA (bukan clone)
            // kalau argumen itu yang menang — tanpa ->copy() di sini, $cur->addDay() di
            // bawah diam-diam ikut memutasi $from/$to asli lintas iterasi event.
            $cur = $ev->start_date->copy()->max($from->copy());
            $end = $ev->end_date->copy()->min($to->copy());
            while ($cur->lte($end)) {
                $dateKey = $cur->toDateString();
                if (! isset($eventByDate[$dateKey])) {
                    $eventByDate[$dateKey] = $ev;
                }
                $cur->addDay();
            }
        }

        // Tanggal yang sudah pernah ditandai tidak_efektif (termasuk yang tidak
        // terhubung ke event kalender manapun) — supaya penanda sebelumnya tetap
        // muncul & tidak ke-reset jadi "efektif" tiap kali template diunduh ulang.
        $existingNed = NonEffectiveDay::whereBetween('tanggal', [$from->toDateString(), $to->toDateString()])
            ->get()
            ->keyBy(fn ($n) => $n->tanggal->toDateString());

        // Gabungkan: semua tanggal event dalam rentang + semua tanggal yang sudah
        // ditandai tidak_efektif secara manual (walau tidak match event manapun).
        // Sabtu/Minggu dikecualikan — tidak dihitung sebagai hari efektif ataupun tidak
        // efektif, jadi tidak perlu diisi di template sama sekali.
        $allDates = array_unique(array_merge(array_keys($eventByDate), $existingNed->keys()->all()));
        $allDates = array_filter($allDates, fn ($d) => ! $this->isWeekendDate($d));
        sort($allDates);

        $tempFile = tempnam(sys_get_temp_dir(), 'ned_tpl_');
        $writer = new XlsxWriter;
        $writer->openToFile($tempFile);

        $this->xlsxSetColumnWidths($writer, [1 => 14, 2 => 16, 3 => 35, 4 => 45]);
        $writer->addRow(Row::fromValuesWithStyle(['tanggal', 'status', 'keterangan', '(ref) event_kalender'], $this->xlsxHeaderStyle()));

        $cellStyle = $this->xlsxCellStyle();
        if (! empty($allDates)) {
            foreach ($allDates as $dateKey) {
                $ned = $existingNed->get($dateKey);
                $ev = $eventByDate[$dateKey] ?? null;

                // Status mencerminkan kondisi SEKARANG di database — bukan tebakan baru
                // tiap kali di-generate. Kalau sudah pernah di-reset ke efektif (tidak ada
                // record NonEffectiveDay), tetap tampil "efektif", bukan "libur" lagi.
                $status = $ned ? 'tidak_efektif' : 'efektif';
                $keterangan = $ned?->keterangan ?: ($ev?->title ?? '');
                $refEvent = $ev ? $ev->title.($ev->description ? ' — '.mb_substr($ev->description, 0, 80) : '') : '';

                $writer->addRow(Row::fromValuesWithStyle([$dateKey, $status, $keterangan, $refEvent], $cellStyle));
            }
        } else {
            // Fallback contoh jika tidak ada event tersinkron ataupun NED tersimpan.
            // nextWeekday menggeser tanggal contoh ke hari kerja terdekat kalau kebetulan
            // jatuh di Sabtu/Minggu, supaya tetap konsisten dengan aturan "tanpa akhir pekan".
            $nextWeekday = function (Carbon $d) {
                while ($this->isWeekendDate($d->toDateString())) {
                    $d->addDay();
                }

                return $d;
            };
            $base = Carbon::create($year, $month ?? 7, 1);
            $writer->addRow(Row::fromValues([$nextWeekday($base->copy())->format('Y-m-d'), 'tidak_efektif', 'Hari Kemerdekaan RI', '']));
            $writer->addRow(Row::fromValues([$nextWeekday($base->copy()->addDays(4))->format('Y-m-d'), 'tidak_efektif', 'Ujian Online', '']));
            $writer->addRow(Row::fromValues([$nextWeekday($base->copy()->addDays(10))->format('Y-m-d'), 'efektif', 'Rapat Dinas (tetap masuk)', '']));
        }

        $writer->close();

        $suffix = $month ? "{$year}_{$month}" : $year;

        return response()->download($tempFile, "template_hari_tidak_efektif_{$suffix}.xlsx", [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }
}
