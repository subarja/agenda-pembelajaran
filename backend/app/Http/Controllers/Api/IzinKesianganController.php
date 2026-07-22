<?php

namespace App\Http\Controllers\Api;

use App\Enums\IzinKesianganStatus;
use App\Http\Controllers\Controller;
use App\Models\IzinKesiangan;
use App\Models\Student;
use App\Support\BellSchedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Izin masuk kesiangan sisi SISWA: ajukan (waktu tiba dicatat otomatis, keterlambatan
 * dihitung dari jam masuk sekolah efektif) & lihat status hari ini.
 */
class IzinKesianganController extends Controller
{
    // ── POST /izin-kesiangan ─────────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $student = $this->student($request);
        $data = $request->validate(['alasan' => ['nullable', 'string', 'max:1000']]);

        $now = Carbon::now('Asia/Jakarta');
        $tanggal = $now->toDateString();

        if (IzinKesiangan::tahunAjaran()->where('student_id', $student->id)->where('tanggal', $tanggal)->exists()) {
            return response()->json(['message' => 'Anda sudah mengajukan izin kesiangan hari ini.'], 422);
        }

        // Keterlambatan = waktu tiba - jam masuk sekolah efektif (sadar mode Apel/Tanpa Apel).
        $terlambat = 0;
        if ($jamMasuk = BellSchedule::jamMasukSekolah($tanggal)) {
            $masuk = Carbon::parse($tanggal.' '.$jamMasuk, 'Asia/Jakarta');
            $terlambat = max(0, intdiv($now->timestamp - $masuk->timestamp, 60));
        }

        $izin = IzinKesiangan::create([
            'student_id' => $student->id,
            'tanggal' => $tanggal,
            'alasan' => $data['alasan'] ?? null,
            'status' => IzinKesianganStatus::Diajukan,
            'waktu_tiba' => $now,
            'terlambat_menit' => $terlambat,
        ]);

        return response()->json([
            'message' => "Izin kesiangan diajukan (terlambat {$terlambat} menit). Menunggu verifikasi guru piket.",
            'data' => $this->present($izin),
        ], 201);
    }

    // ── GET /izin-kesiangan/hari-ini ─────────────────────────────────────────
    public function hariIni(Request $request): JsonResponse
    {
        $student = $this->student($request);
        $tanggal = Carbon::now('Asia/Jakarta')->toDateString();

        $izin = IzinKesiangan::tahunAjaran()
            ->where('student_id', $student->id)
            ->where('tanggal', $tanggal)
            ->first();

        return response()->json(['data' => $izin ? $this->present($izin) : null]);
    }

    private function student(Request $request): Student
    {
        $student = $request->user()->student;
        abort_if(! $student, 403, 'Hanya siswa yang bisa mengajukan izin kesiangan.');

        return $student;
    }

    private function present(IzinKesiangan $i): array
    {
        return [
            'id' => $i->uuid,
            'tanggal' => $i->tanggal->toDateString(),
            'alasan' => $i->alasan,
            'status' => $i->status->value,
            'status_label' => $i->status->label(),
            'waktu_tiba' => $i->waktu_tiba?->format('H:i'),
            'terlambat_menit' => $i->terlambat_menit,
        ];
    }
}
