<?php

namespace App\Http\Controllers\Api;

use App\Enums\IzinKeluarStatus;
use App\Http\Controllers\Controller;
use App\Models\IzinKeluar;
use App\Models\Student;
use App\Notifications\IzinKeluarDiajukanNotification;
use App\Support\PiketAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;

/**
 * Izin keluar sisi SISWA: ajukan izin, lihat izin aktif hari ini (+ QR bila disetujui),
 * batalkan sebelum keluar. Persetujuan & masa berlaku ditetapkan guru piket.
 */
class IzinKeluarController extends Controller
{
    // ── POST /izin-keluar ────────────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $student = $this->student($request);
        $data = $request->validate([
            'keperluan' => ['required', 'string', 'max:120'],
            'alasan' => ['nullable', 'string', 'max:1000'],
        ]);

        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();

        // Cegah izin ganda aktif di hari yang sama.
        $adaAktif = IzinKeluar::tahunAjaran()
            ->where('student_id', $student->id)
            ->where('tanggal', $tanggal)
            ->whereIn('status', ['diajukan', 'disetujui', 'keluar'])
            ->exists();
        if ($adaAktif) {
            return response()->json(['message' => 'Masih ada izin keluar yang aktif hari ini.'], 422);
        }

        $izin = IzinKeluar::create([
            'student_id' => $student->id,
            'tanggal' => $tanggal,
            'keperluan' => $data['keperluan'],
            'alasan' => $data['alasan'] ?? null,
            'status' => IzinKeluarStatus::Diajukan,
        ]);

        Notification::send(PiketAccess::petugasUsers(), new IzinKeluarDiajukanNotification($izin));

        return response()->json(['message' => 'Izin keluar diajukan. Menunggu persetujuan guru piket.', 'data' => $this->present($izin)], 201);
    }

    // ── GET /izin-keluar/aktif ───────────────────────────────────────────────
    public function aktif(Request $request): JsonResponse
    {
        $student = $this->student($request);
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();

        $daftar = IzinKeluar::tahunAjaran()
            ->where('student_id', $student->id)
            ->where('tanggal', $tanggal)
            ->orderByDesc('id')
            ->get()
            ->map(fn ($i) => $this->present($i));

        return response()->json(['data' => $daftar]);
    }

    // ── POST /izin-keluar/{uuid}/batal ───────────────────────────────────────
    public function batal(Request $request, string $uuid): JsonResponse
    {
        $student = $this->student($request);
        $izin = IzinKeluar::tahunAjaran()->where('uuid', $uuid)->where('student_id', $student->id)->firstOrFail();

        if (! in_array($izin->status, [IzinKeluarStatus::Diajukan, IzinKeluarStatus::Disetujui], true)) {
            return response()->json(['message' => 'Izin ini tidak bisa dibatalkan.'], 422);
        }

        $izin->update(['status' => IzinKeluarStatus::Dibatalkan, 'qr_token' => null]);

        return response()->json(['message' => 'Izin keluar dibatalkan.']);
    }

    private function student(Request $request): Student
    {
        $student = $request->user()->student;
        abort_if(! $student, 403, 'Hanya siswa yang bisa mengajukan izin keluar.');

        return $student;
    }

    /** QR token hanya diungkap saat izin disetujui / sedang keluar. */
    private function present(IzinKeluar $i): array
    {
        $tampilkanQr = in_array($i->status, [IzinKeluarStatus::Disetujui, IzinKeluarStatus::Keluar], true);

        return [
            'id' => $i->uuid,
            'tanggal' => $i->tanggal->toDateString(),
            'keperluan' => $i->keperluan,
            'alasan' => $i->alasan,
            'status' => $i->status->value,
            'status_label' => $i->status->label(),
            'berlaku_dari' => $i->berlaku_dari?->format('H:i'),
            'berlaku_sampai' => $i->berlaku_sampai?->format('H:i'),
            'qr_token' => $tampilkanQr ? $i->qr_token : null,
            'waktu_keluar' => $i->waktu_keluar?->format('H:i'),
            'waktu_masuk' => $i->waktu_masuk?->format('H:i'),
            'catatan_piket' => $i->catatan_piket,
        ];
    }
}
