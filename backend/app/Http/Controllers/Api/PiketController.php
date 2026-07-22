<?php

namespace App\Http\Controllers\Api;

use App\Enums\IzinKeluarStatus;
use App\Http\Controllers\Controller;
use App\Models\IzinKeluar;
use App\Models\PiketAssignment;
use App\Support\BellRingPlan;
use App\Support\PiketAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Dashboard Piket (guru piket hari itu). Bel real-time + daftar petugas (S3) dan proses
 * izin keluar QR (S4). Kesiangan/absensi/resume menyusul. Semua endpoint diproteksi
 * PiketAccess::isPetugas.
 */
class PiketController extends Controller
{
    // ── GET /piket/ringkasan ─────────────────────────────────────────────────
    public function ringkasan(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $petugas = PiketAssignment::tahunAjaran()
            ->with('teacher.user')
            ->where('tanggal', $tanggal)
            ->get()
            ->map(fn ($a) => $a->teacher?->user?->nama)
            ->filter()->values();

        return response()->json(['data' => [
            'tanggal' => $tanggal,
            'server_time' => Carbon::now('Asia/Jakarta')->format('H:i:s'),
            'petugas' => $petugas,
            'events' => BellRingPlan::forDate($tanggal),
        ]]);
    }

    // ── GET /piket/izin-keluar — pengajuan + status hari ini ─────────────────
    public function izinKeluar(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $daftar = IzinKeluar::tahunAjaran()
            ->with('student.user', 'student.schoolClass')
            ->where('tanggal', $tanggal)
            ->orderByDesc('id')
            ->get()
            ->map(fn ($i) => $this->presentIzin($i));

        return response()->json(['data' => $daftar]);
    }

    // ── POST /piket/izin-keluar/{uuid}/proses — setujui/tolak/batalkan ───────
    public function prosesIzinKeluar(Request $request, string $uuid): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $data = $request->validate([
            'aksi' => ['required', Rule::in(['setujui', 'tolak', 'batalkan'])],
            'berlaku_sampai' => ['required_if:aksi,setujui', 'nullable', 'date_format:H:i'],
            'berlaku_dari' => ['nullable', 'date_format:H:i'],
            'catatan_piket' => ['nullable', 'string', 'max:255'],
        ]);

        $izin = IzinKeluar::tahunAjaran()->where('uuid', $uuid)->firstOrFail();
        $teacherId = $request->user()->teacher?->id;

        if ($data['aksi'] === 'setujui') {
            abort_unless($izin->status === IzinKeluarStatus::Diajukan, 422, 'Izin ini tidak dalam status menunggu.');

            $hari = Carbon::now('Asia/Jakarta');
            $dari = $data['berlaku_dari'] ?? $hari->format('H:i');

            $izin->fill([
                'status' => IzinKeluarStatus::Disetujui,
                'diproses_oleh' => $teacherId,
                'berlaku_dari' => Carbon::parse($tanggal.' '.$dari, 'Asia/Jakarta'),
                'berlaku_sampai' => Carbon::parse($tanggal.' '.$data['berlaku_sampai'], 'Asia/Jakarta'),
                'catatan_piket' => $data['catatan_piket'] ?? null,
            ]);
            $izin->qr_token = $izin->generateQrToken();
            $izin->save();

            return response()->json(['message' => 'Izin disetujui. QR muncul di akun siswa.']);
        }

        if ($data['aksi'] === 'tolak') {
            abort_unless($izin->status === IzinKeluarStatus::Diajukan, 422, 'Izin ini tidak dalam status menunggu.');
            $izin->update(['status' => IzinKeluarStatus::Ditolak, 'diproses_oleh' => $teacherId, 'catatan_piket' => $data['catatan_piket'] ?? null]);

            return response()->json(['message' => 'Izin ditolak.']);
        }

        // batalkan (sebelum keluar)
        abort_unless(in_array($izin->status, [IzinKeluarStatus::Diajukan, IzinKeluarStatus::Disetujui], true), 422, 'Izin ini tidak bisa dibatalkan.');
        $izin->update(['status' => IzinKeluarStatus::Dibatalkan, 'qr_token' => null, 'catatan_piket' => $data['catatan_piket'] ?? null]);

        return response()->json(['message' => 'Izin dibatalkan.']);
    }

    // ── GET /piket/izin-keluar/log — keluar/masuk real-time hari ini ─────────
    public function izinKeluarLog(Request $request): JsonResponse
    {
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();
        $this->pastikanPetugas($request, $tanggal);

        $log = IzinKeluar::tahunAjaran()
            ->with('student.user', 'scanKeluar', 'scanMasuk')
            ->where('tanggal', $tanggal)
            ->whereNotNull('waktu_keluar')
            ->orderByDesc('waktu_keluar')
            ->get()
            ->map(fn ($i) => [
                'id' => $i->uuid,
                'nama' => $i->student?->user?->nama,
                'keperluan' => $i->keperluan,
                'status' => $i->status->value,
                'status_label' => $i->status->label(),
                'waktu_keluar' => $i->waktu_keluar?->format('H:i'),
                'scan_keluar' => $i->scanKeluar?->nama,
                'waktu_masuk' => $i->waktu_masuk?->format('H:i'),
                'scan_masuk' => $i->scanMasuk?->nama,
            ]);

        return response()->json(['data' => $log]);
    }

    private function presentIzin(IzinKeluar $i): array
    {
        return [
            'id' => $i->uuid,
            'nama' => $i->student?->user?->nama,
            'kelas' => $i->student?->schoolClass?->label(),
            'foto_url' => $i->student?->foto ? Storage::disk('public')->url($i->student->foto) : null,
            'keperluan' => $i->keperluan,
            'alasan' => $i->alasan,
            'status' => $i->status->value,
            'status_label' => $i->status->label(),
            'berlaku_dari' => $i->berlaku_dari?->format('H:i'),
            'berlaku_sampai' => $i->berlaku_sampai?->format('H:i'),
            'waktu_keluar' => $i->waktu_keluar?->format('H:i'),
            'waktu_masuk' => $i->waktu_masuk?->format('H:i'),
            'catatan_piket' => $i->catatan_piket,
        ];
    }

    /** Abort 403 bila user bukan petugas piket pada tanggal itu. */
    private function pastikanPetugas(Request $request, string $tanggal): void
    {
        abort_unless(PiketAccess::isPetugas($request->user(), $tanggal), 403, 'Anda tidak bertugas piket hari ini.');
    }
}
