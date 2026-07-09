<?php

namespace App\Console\Commands;

use App\Enums\SubstitutionStatus;
use App\Models\SubstitutionRequest;
use App\Notifications\SubstitutionExpiredNotification;
use Illuminate\Console\Command;

/**
 * Tandai pengajuan inval yang tidak pernah dijawab sampai sesi terakhirnya lewat.
 *
 * PENTING: kebenaran sistem TIDAK bergantung pada command ini. Hanya status `disetujui`
 * yang memindahkan kewajiban agenda, jadi pengajuan yang didiamkan memang sudah tidak
 * mengalihkan apa pun sejak awal — sesi itu tetap kewajiban pengaju walau cron mati.
 *
 * Yang dikerjakan di sini murni kebersihan dan kejujuran ke pengguna: status berhenti
 * menampilkan "menunggu jawaban" untuk sesi yang sudah berlalu, sesi terbebas dari kunci
 * `slot_aktif` sehingga bisa diajukan ulang bila masih dalam batas, dan KEDUA guru diberi
 * tahu — pengaju agar sadar kewajibannya tidak pernah berpindah, calon pengganti agar tahu
 * ia melewatkan permintaan.
 */
class ExpireSubstitutionRequests extends Command
{
    protected $signature = 'inval:kedaluwarsa {--dry-run : Tampilkan saja, jangan ubah apa pun}';

    protected $description = 'Kedaluwarsakan pengajuan guru inval yang tidak dijawab sampai sesinya lewat';

    public function handle(): int
    {
        $kandidat = SubstitutionRequest::where('status', SubstitutionStatus::Diajukan)
            ->with(['sessions.schedule', 'requester.user', 'substitute.user'])
            ->get()
            ->filter(function (SubstitutionRequest $req) {
                $selesai = $req->sesiTerakhirSelesaiPada();

                return $selesai !== null && now()->greaterThan($selesai);
            });

        if ($kandidat->isEmpty()) {
            $this->info('Tidak ada pengajuan yang perlu dikedaluwarsakan.');

            return self::SUCCESS;
        }

        foreach ($kandidat as $req) {
            $label = ($req->requester->user?->nama ?? '?').' → '.($req->substitute->user?->nama ?? '?');

            if ($this->option('dry-run')) {
                $this->line("[dry-run] {$label}");

                continue;
            }

            $req->pindahStatus(SubstitutionStatus::Kedaluwarsa);

            // Ke keduanya: isi pesannya berbeda, ditentukan notifikasi berdasarkan penerima.
            $req->requester->user?->notify(new SubstitutionExpiredNotification($req));
            $req->substitute->user?->notify(new SubstitutionExpiredNotification($req));

            $this->line("Kedaluwarsa: {$label}");
        }

        $this->info($kandidat->count().' pengajuan diproses.');

        return self::SUCCESS;
    }
}
