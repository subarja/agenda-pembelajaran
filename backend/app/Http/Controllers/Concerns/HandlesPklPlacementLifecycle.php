<?php

namespace App\Http\Controllers\Concerns;

use App\Enums\PklPlacementStatus;
use App\Models\PklPlacement;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * Logika ubah siklus hidup penempatan PKL (selesai / mengundurkan diri / dipindahkan /
 * buka kembali), dipakai bersama oleh controller admin dan pembimbing agar aturannya
 * satu sumber. Penonaktifan siswa ("keluar sekolah") ditangani terpisah oleh admin.
 */
trait HandlesPklPlacementLifecycle
{
    protected function pklLifecycleRules(): array
    {
        return [
            'status' => ['required', Rule::enum(PklPlacementStatus::class)],
            'tanggal_berakhir_aktual' => ['nullable', 'date'],
            'alasan_berakhir' => ['nullable', 'string', 'max:300'],
        ];
    }

    /**
     * Terapkan perubahan status ke penempatan. Melempar 422 bila tanggal tak masuk akal.
     */
    protected function applyPklLifecycle(PklPlacement $p, array $data): void
    {
        $status = $data['status'] instanceof PklPlacementStatus
            ? $data['status'] : PklPlacementStatus::from($data['status']);
        $aktual = $data['tanggal_berakhir_aktual'] ?? null;
        $alasan = $data['alasan_berakhir'] ?? null;

        $today = Carbon::now(config('app.school_timezone'))->toDateString();
        $mulai = $p->tanggal_mulai?->toDateString();

        if ($status === PklPlacementStatus::Berlangsung) {
            // Buka kembali → bersihkan penutupan sebelumnya.
            $aktual = null;
            $alasan = null;
        } elseif ($mulai && ! $aktual) {
            // Semua penutupan (selesai/mundur/pindah) untuk penempatan yang SUDAH
            // berjalan wajib menyertakan tanggal berhenti. "Selesai sesuai jadwal"
            // tidak perlu tombol ini — sudah otomatis dari tanggal (effectiveStatus).
            // Placeholder "belum diplot" (tanpa tanggal mulai) boleh tanpa tanggal.
            abort(422, 'Tanggal berhenti/selesai wajib diisi.');
        }

        if ($aktual) {
            abort_if($mulai && $aktual < $mulai, 422, 'Tanggal tidak boleh sebelum tanggal mulai PKL.');
            abort_if($aktual > $today, 422, 'Tanggal tidak boleh di masa depan.');
            if ($status === PklPlacementStatus::Selesai && $p->tanggal_selesai) {
                abort_if(
                    $aktual > $p->tanggal_selesai->toDateString(),
                    422,
                    'Untuk selesai lebih awal, tanggal harus sebelum atau sama dengan tanggal selesai rencana.',
                );
            }
        }

        $p->update([
            'status' => $status,
            'tanggal_berakhir_aktual' => $aktual,
            'alasan_berakhir' => $alasan,
        ]);
    }
}
