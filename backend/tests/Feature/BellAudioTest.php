<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\BellAudio;
use App\Models\BellAudioMap;
use App\Models\BellDevice;
use App\Models\BellMode;
use App\Models\BellPeriod;
use App\Models\User;
use App\Support\BellRingPlan;
use App\Support\BellSchedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 2 modul Bel: bank audio, pemetaan event -> audio, jadwal bunyi hari ini (kiosk),
 * dan proteksi token perangkat untuk endpoint tulis.
 */
class BellAudioTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        BellSchedule::flush();
        Storage::fake('public');

        // Bel Senin: 2 jam pelajaran, istirahat, 1 jam pelajaran.
        foreach ([
            [1, '07:00', '07:45', false],
            [2, '07:45', '08:30', false],
            [3, '08:30', '08:45', true],   // istirahat
            [4, '08:45', '09:30', false],
        ] as [$ke, $m, $s, $ist]) {
            BellPeriod::create(['hari' => 'senin', 'jam_ke' => $ke, 'jam_mulai' => $m, 'jam_selesai' => $s, 'is_istirahat' => $ist]);
        }
    }

    private function admin(): User
    {
        return User::create(['nama' => 'Admin', 'email' => 'admin@test.sch.id', 'password' => 'secret123', 'role' => UserRole::Admin]);
    }

    public function test_admin_upload_audio_dengan_nama_file_deterministik(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/v1/admin/bell-audios', [
            'nama'     => 'Bel Masuk Pagi',
            'kategori' => 'masuk',
            'file'     => UploadedFile::fake()->create('sumber.mp3', 120, 'audio/mpeg'),
        ])->assertCreated();

        $audio = BellAudio::first();
        $this->assertSame('audio_bel/audio-bel-masuk-pagi.mp3', $audio->path);
        Storage::disk('public')->assertExists($audio->path);
    }

    public function test_jadwal_bunyi_hari_ini_menurunkan_event_dari_bel(): void
    {
        $events = BellRingPlan::forDate('2026-03-09'); // Senin
        $ringkas = array_map(fn ($e) => [$e['waktu'], $e['jenis_event']], $events);

        $this->assertSame([
            ['07:00:00', 'masuk'],
            ['07:45:00', 'pergantian'],
            ['08:30:00', 'istirahat_mulai'],
            ['08:45:00', 'istirahat_selesai'],
            ['09:30:00', 'pulang'],
        ], $ringkas);
    }

    public function test_pemetaan_event_muncul_sebagai_audio_url_di_kiosk(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/v1/admin/bell-audios', [
            'nama' => 'Bel Masuk', 'kategori' => 'masuk',
            'file' => UploadedFile::fake()->create('a.mp3', 100, 'audio/mpeg'),
        ])->assertCreated();
        $audio = BellAudio::first();

        // Pemetaan global (semua mode) untuk event masuk.
        $this->putJson('/api/v1/admin/bell-audio-maps', [
            'bell_mode_id' => null, 'jenis_event' => 'masuk', 'bell_audio_id' => $audio->id,
        ])->assertOk();

        $events = collect(BellRingPlan::forDate('2026-03-09'));
        $masuk  = $events->firstWhere('jenis_event', 'masuk');
        $this->assertSame($audio->id, $masuk['bell_audio_id']);
        $this->assertNotNull($masuk['audio_url']);

        // Event pulang tak dipetakan -> tanpa audio.
        $this->assertNull($events->firstWhere('jenis_event', 'pulang')['bell_audio_id']);
    }

    public function test_pemetaan_spesifik_mode_mengalahkan_global(): void
    {
        Sanctum::actingAs($this->admin());
        $tanpaApel = BellMode::where('nama', 'Tanpa Apel')->first();

        $g = BellAudio::create(['nama' => 'Global', 'kategori' => 'masuk', 'path' => 'audio_bel/g.mp3', 'aktif' => true]);
        $s = BellAudio::create(['nama' => 'Spesifik', 'kategori' => 'masuk', 'path' => 'audio_bel/s.mp3', 'aktif' => true]);
        BellAudioMap::create(['bell_mode_id' => null, 'jenis_event' => 'masuk', 'bell_audio_id' => $g->id]);
        BellAudioMap::create(['bell_mode_id' => $tanpaApel->id, 'jenis_event' => 'masuk', 'bell_audio_id' => $s->id]);

        // Jadikan Tanpa Apel default global -> mode tanggal itu = Tanpa Apel.
        BellMode::where('nama', 'Apel')->update(['is_default' => false]);
        $tanpaApel->update(['is_default' => true]);
        BellSchedule::flush();

        $masuk = collect(BellRingPlan::forDate('2026-03-09'))->firstWhere('jenis_event', 'masuk');
        $this->assertSame($s->id, $masuk['bell_audio_id'], 'pemetaan spesifik mode harus menang');
    }

    public function test_jadwal_bunyi_kustom_muncul_di_kiosk_dengan_volume(): void
    {
        Sanctum::actingAs($this->admin());

        $audio = BellAudio::create(['nama' => 'Murottal', 'kategori' => 'murottal', 'path' => 'audio_bel/m.mp3', 'volume' => 60, 'aktif' => true]);

        // Bunyi kustom 06:50, hanya Senin.
        $this->postJson('/api/v1/admin/bell-custom-rings', [
            'nama' => 'Murottal Pagi', 'waktu' => '06:50', 'bell_audio_id' => $audio->id, 'hari' => ['senin'],
        ])->assertCreated();

        // Senin (2026-03-09) -> muncul; jadwal kustom TIDAK digeser mode (jam dinding tetap).
        \Illuminate\Support\Carbon::setTestNow('2026-03-09 06:00:00');
        $senin = $this->getJson('/api/v1/bel/hari-ini')->assertOk()->json('data.events');
        \Illuminate\Support\Carbon::setTestNow();
        $kustom = collect($senin)->firstWhere('jenis_label', 'Murottal Pagi');
        $this->assertNotNull($kustom, 'bunyi kustom harus muncul hari Senin');
        $this->assertSame('06:50:00', $kustom['waktu']);
        $this->assertTrue($kustom['custom']);
        $this->assertSame(60, $kustom['volume']);
    }

    public function test_jadwal_bunyi_kustom_hormati_hari(): void
    {
        Sanctum::actingAs($this->admin());
        $audio = BellAudio::create(['nama' => 'Lagu', 'kategori' => 'khusus', 'path' => 'audio_bel/l.mp3', 'aktif' => true]);
        $this->postJson('/api/v1/admin/bell-custom-rings', [
            'nama' => 'Lagu Senin', 'waktu' => '06:30', 'bell_audio_id' => $audio->id, 'hari' => ['senin'],
        ])->assertCreated();

        // Rabu (2026-03-11) -> tidak muncul.
        \Illuminate\Support\Carbon::setTestNow('2026-03-11 06:00:00');
        $rabu = $this->getJson('/api/v1/bel/hari-ini')->json('data.events');
        \Illuminate\Support\Carbon::setTestNow();
        $this->assertNull(collect($rabu)->firstWhere('jenis_label', 'Lagu Senin'));
    }

    public function test_kiosk_tulis_butuh_token_perangkat(): void
    {
        // Tanpa token -> 403.
        $this->postJson('/api/v1/bel/ring-log', [
            'jenis_event' => 'masuk', 'waktu' => '07:00:00', 'status' => 'berhasil',
        ])->assertStatus(403);

        $device = BellDevice::create(['nama' => 'Kiosk Lobi', 'token' => 'tok-abc', 'aktif' => true]);
        $this->postJson('/api/v1/bel/ring-log', [
            'device_token' => 'tok-abc',
            'jenis_event'  => 'masuk', 'waktu' => '07:00:00', 'status' => 'berhasil',
        ])->assertOk();

        $this->assertDatabaseHas('bell_ring_logs', ['jenis_event' => 'masuk', 'bell_device_id' => $device->id]);
    }

    public function test_hari_ini_publik_dan_heartbeat_perangkat(): void
    {
        $device = BellDevice::create(['nama' => 'Kiosk', 'token' => 'tok-hb', 'aktif' => true]);

        $this->getJson('/api/v1/bel/hari-ini?device_token=tok-hb')
            ->assertOk()
            ->assertJsonPath('data.tanggal', now('Asia/Jakarta')->toDateString());

        $this->assertNotNull($device->fresh()->last_heartbeat_at);
    }
}
