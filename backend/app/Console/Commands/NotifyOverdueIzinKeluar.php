<?php

namespace App\Console\Commands;

use App\Enums\IzinKeluarStatus;
use App\Models\IzinKeluar;
use App\Notifications\IzinKeluarTerlambatNotification;
use App\Support\PiketAccess;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;

/**
 * Notifikasi ke petugas piket bila ada siswa yang sudah KELUAR tapi belum kembali melewati
 * batas berlaku izin (berlaku_sampai). Dikirim SEKALI per izin (flag terlambat_dinotifikasi).
 * Dijadwalkan tiap 5 menit (butuh cron `schedule:run`).
 */
class NotifyOverdueIzinKeluar extends Command
{
    protected $signature = 'izin-keluar:terlambat';

    protected $description = 'Notifikasi piket: siswa belum kembali melewati batas izin keluar.';

    public function handle(): int
    {
        $now = Carbon::now('Asia/Jakarta');

        $terlambat = IzinKeluar::with('student.user')
            ->whereDate('tanggal', $now->toDateString())
            ->where('status', IzinKeluarStatus::Keluar)
            ->where('terlambat_dinotifikasi', false)
            ->whereNotNull('berlaku_sampai')
            ->where('berlaku_sampai', '<', $now)
            ->get();

        // Target = petugas shift yang aktif sekarang (fallback ke seluruh petugas hari itu).
        $petugas = PiketAccess::petugasUsers();

        foreach ($terlambat as $izin) {
            if ($petugas->isNotEmpty()) {
                Notification::send($petugas, new IzinKeluarTerlambatNotification($izin));
            }
            $izin->update(['terlambat_dinotifikasi' => true]);
        }

        $this->info($terlambat->count().' siswa terlambat kembali diproses.');

        return self::SUCCESS;
    }
}
