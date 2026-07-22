<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\BellEvent;
use App\Http\Controllers\Controller;
use App\Models\BellAudio;
use App\Models\BellAudioMap;
use App\Models\BellCustomRing;
use App\Models\BellDevice;
use App\Models\BellMode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Panel Admin -> Bel & Audio: bank suara bel + pemetaan event -> audio per mode.
 * Audio disimpan di disk 'public' (ikut pindah R2 otomatis bila admin aktifkan) dengan
 * nama file deterministik (audio-{slug}.mp3), bukan hash. Pemutar kiosk memakainya lewat
 * App\Support\BellRingPlan.
 */
class BellAudioController extends Controller
{
    private const FOLDER = 'audio_bel';

    private const MAX_KB = 5120;

    // ── GET /admin/bell-audios ───────────────────────────────────────────────
    public function index(): JsonResponse
    {
        return response()->json(['data' => [
            'audios' => BellAudio::orderByDesc('created_at')->get()->map(fn ($a) => $this->present($a)),
            'maps' => BellAudioMap::get()->map(fn ($m) => [
                'id' => $m->id,
                'bell_mode_id' => $m->bell_mode_id,
                'jenis_event' => $m->jenis_event->value,
                'bell_audio_id' => $m->bell_audio_id,
                'aktif' => $m->aktif,
            ]),
            'modes' => BellMode::orderBy('id')->get(['id', 'nama', 'is_default']),
            'events' => array_map(fn (BellEvent $e) => ['value' => $e->value, 'label' => $e->label()], BellEvent::cases()),
            'custom_rings' => BellCustomRing::with('audio')->orderBy('waktu')->get()->map(fn ($r) => [
                'id' => $r->id,
                'uuid' => $r->uuid,
                'nama' => $r->nama,
                'waktu' => substr($r->waktu, 0, 5),
                'bell_audio_id' => $r->bell_audio_id,
                'audio_nama' => $r->audio?->nama,
                'hari' => $r->hari ?? [],
                'aktif' => $r->aktif,
            ]),
            'devices' => BellDevice::orderByDesc('created_at')->get()->map(fn ($d) => [
                'id' => $d->id,
                'uuid' => $d->uuid,
                'nama' => $d->nama,
                'token' => $d->token,
                'aktif' => $d->aktif,
                'last_heartbeat_at' => $d->last_heartbeat_at?->toIso8601String(),
            ]),
        ]]);
    }

    // ── POST /admin/bell-devices — daftarkan perangkat kiosk (menghasilkan token) ──
    public function storeDevice(Request $request): JsonResponse
    {
        $data = $request->validate(['nama' => ['nullable', 'string', 'max:80']]);

        $device = BellDevice::create([
            'nama' => $data['nama'] ?: 'Pemutar Bel '.(BellDevice::count() + 1),
            'token' => Str::random(48),
            'aktif' => true,
        ]);

        return response()->json(['message' => "Perangkat \"{$device->nama}\" didaftarkan.", 'data' => [
            'uuid' => $device->uuid, 'nama' => $device->nama, 'token' => $device->token,
        ]], 201);
    }

    // ── DELETE /admin/bell-devices/{device} ──────────────────────────────────
    public function destroyDevice(BellDevice $device): JsonResponse
    {
        $device->delete();

        return response()->json(['message' => "Perangkat \"{$device->nama}\" dihapus."]);
    }

    // ── POST /admin/bell-audios ──────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nama' => ['required', 'string', 'max:120'],
            'kategori' => ['required', Rule::in(BellEvent::values())],
            'durasi_detik' => ['nullable', 'integer', 'min:0', 'max:3600'],
            'volume' => ['nullable', 'integer', 'min:0', 'max:100'],
            'file' => ['required', 'file', 'mimetypes:audio/mpeg,audio/ogg,audio/mp3', 'max:'.self::MAX_KB],
        ]);

        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension()) ?: 'mp3';
        $path = $this->storeAudio($file, $data['nama'], $ext);

        $audio = BellAudio::create([
            'nama' => $data['nama'],
            'kategori' => $data['kategori'],
            'disk' => 'public',
            'path' => $path,
            'durasi_detik' => $data['durasi_detik'] ?? null,
            'volume' => $data['volume'] ?? 100,
            'ukuran_byte' => $file->getSize(),
            'uploaded_by' => $request->user()->id,
            'aktif' => true,
        ]);

        return response()->json(['message' => "Audio \"{$audio->nama}\" ditambahkan.", 'data' => $this->present($audio)], 201);
    }

    // ── PUT /admin/bell-audios/{audio} ───────────────────────────────────────
    public function update(Request $request, BellAudio $audio): JsonResponse
    {
        $data = $request->validate([
            'nama' => ['sometimes', 'string', 'max:120'],
            'kategori' => ['sometimes', Rule::in(BellEvent::values())],
            'aktif' => ['sometimes', 'boolean'],
            'durasi_detik' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:3600'],
            'volume' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'file' => ['sometimes', 'file', 'mimetypes:audio/mpeg,audio/ogg,audio/mp3', 'max:'.self::MAX_KB],
        ]);

        // Ganti berkas tanpa mengganti id (brief: replace in place).
        if ($request->hasFile('file')) {
            $this->deleteFile($audio);
            $file = $request->file('file');
            $ext = strtolower($file->getClientOriginalExtension()) ?: 'mp3';
            $audio->path = $this->storeAudio($file, $data['nama'] ?? $audio->nama, $ext, $audio->id);
            $audio->ukuran_byte = $file->getSize();
        }

        $audio->fill(array_intersect_key($data, array_flip(['nama', 'kategori', 'aktif', 'durasi_detik', 'volume'])));
        $audio->save();

        return response()->json(['message' => 'Audio diperbarui.', 'data' => $this->present($audio->fresh())]);
    }

    // ── DELETE /admin/bell-audios/{audio} — soft delete ──────────────────────
    public function destroy(BellAudio $audio): JsonResponse
    {
        $audio->delete();

        return response()->json(['message' => "Audio \"{$audio->nama}\" dinonaktifkan (bisa dipulihkan)."]);
    }

    // ── POST /admin/bell-audios/{uuid}/restore ───────────────────────────────
    public function restore(string $uuid): JsonResponse
    {
        $audio = BellAudio::withTrashed()->where('uuid', $uuid)->firstOrFail();
        $audio->restore();

        return response()->json(['message' => "Audio \"{$audio->nama}\" dipulihkan."]);
    }

    // ── PUT /admin/bell-audio-maps — upsert satu pemetaan event x mode ────────
    public function upsertMap(Request $request): JsonResponse
    {
        $data = $request->validate([
            'bell_mode_id' => ['nullable', 'integer', 'exists:bell_modes,id'],
            'jenis_event' => ['required', Rule::in(BellEvent::values())],
            'bell_audio_id' => ['nullable', 'integer', 'exists:bell_audios,id'],
        ]);

        $key = ['bell_mode_id' => $data['bell_mode_id'] ?? null, 'jenis_event' => $data['jenis_event']];

        // audio null => hapus pemetaan (kembali ke fallback/tak berbunyi).
        if (empty($data['bell_audio_id'])) {
            BellAudioMap::where($key)->delete();

            return response()->json(['message' => 'Pemetaan dihapus.']);
        }

        BellAudioMap::updateOrCreate($key, ['bell_audio_id' => $data['bell_audio_id'], 'aktif' => true]);

        return response()->json(['message' => 'Pemetaan disimpan.']);
    }

    /** Simpan berkas audio dengan nama deterministik audio-{slug}.ext; hindari tabrakan antar-record. */
    private function storeAudio(UploadedFile $file, string $nama, string $ext, ?int $ignoreId = null): string
    {
        $slug = Str::slug($nama) ?: 'audio';
        $base = 'audio-'.$slug;
        $path = self::FOLDER."/{$base}.{$ext}";

        // Bila path sudah dipakai record LAIN, tambahkan sufiks angka agar tidak menimpa.
        $n = 2;
        while (BellAudio::withTrashed()->where('path', $path)->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->exists()) {
            $path = self::FOLDER."/{$base}-{$n}.{$ext}";
            $n++;
        }

        Storage::disk('public')->putFileAs(self::FOLDER, $file, basename($path));

        return $path;
    }

    private function deleteFile(BellAudio $audio): void
    {
        if ($audio->path && Storage::disk($audio->disk ?: 'public')->exists($audio->path)) {
            Storage::disk($audio->disk ?: 'public')->delete($audio->path);
        }
    }

    private function present(BellAudio $a): array
    {
        return [
            'id' => $a->id,
            'uuid' => $a->uuid,
            'nama' => $a->nama,
            'kategori' => $a->kategori->value,
            'kategori_label' => $a->kategori->label(),
            'durasi_detik' => $a->durasi_detik,
            'volume' => $a->volume ?? 100,
            'ukuran_byte' => $a->ukuran_byte,
            'aktif' => $a->aktif,
            'url' => $a->url(),
            'created_at' => $a->created_at?->toIso8601String(),
        ];
    }

    // ── Jadwal Bunyi Kustom (jam eksplisit -> audio) ─────────────────────────
    private const HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];

    // POST /admin/bell-custom-rings
    public function storeCustomRing(Request $request): JsonResponse
    {
        $data = $this->validateCustomRing($request);
        BellCustomRing::create($data);

        return response()->json(['message' => "Jadwal bunyi \"{$data['nama']}\" ditambahkan."], 201);
    }

    // PUT /admin/bell-custom-rings/{ring}
    public function updateCustomRing(Request $request, BellCustomRing $ring): JsonResponse
    {
        $ring->update($this->validateCustomRing($request));

        return response()->json(['message' => 'Jadwal bunyi diperbarui.']);
    }

    // DELETE /admin/bell-custom-rings/{ring}
    public function destroyCustomRing(BellCustomRing $ring): JsonResponse
    {
        $ring->delete();

        return response()->json(['message' => 'Jadwal bunyi dihapus.']);
    }

    private function validateCustomRing(Request $request): array
    {
        $data = $request->validate([
            'nama' => ['required', 'string', 'max:120'],
            'waktu' => ['required', 'date_format:H:i'],
            'bell_audio_id' => ['required', 'integer', 'exists:bell_audios,id'],
            'hari' => ['nullable', 'array'],
            'hari.*' => [Rule::in(self::HARI)],
            'aktif' => ['sometimes', 'boolean'],
        ]);

        // hari kosong = setiap hari (disimpan null).
        $data['hari'] = empty($data['hari']) ? null : array_values(array_unique($data['hari']));

        return $data;
    }
}
