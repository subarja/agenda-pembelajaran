<?php

namespace App\Notifications\Concerns;

use App\Models\SubstitutionRequest;
use App\Models\SubstitutionSession;

/**
 * Ringkasan sesi yang dipakai keempat notifikasi inval.
 *
 * Notifikasi push tampil di layar kunci HP dengan ruang beberapa baris saja, jadi teksnya
 * harus menjawab pertanyaan guru dalam sekali baca: kelas mana, hari/tanggal berapa, jam
 * berapa. Satu pengajuan bisa memuat beberapa sesi — sesi pertama disebut utuh, sisanya
 * diringkas jadi "+N sesi lain" daripada memenuhi layar.
 */
trait DescribesSubstitution
{
    protected function ringkasanSesi(SubstitutionRequest $req): string
    {
        $sesi = $req->sessions->sortBy(fn (SubstitutionSession $s) => $s->tanggal->toDateString().$s->schedule?->jam_mulai);

        $pertama = $sesi->first();
        if (! $pertama) {
            return '—';
        }

        $teks = $this->baris($pertama);
        $sisa = $sesi->count() - 1;

        return $sisa > 0 ? "{$teks} +{$sisa} sesi lain" : $teks;
    }

    protected function baris(SubstitutionSession $s): string
    {
        $tanggal = $s->tanggal->locale('id')->isoFormat('ddd, D MMM');
        $waktu   = $s->schedule ? \App\Support\BellSchedule::resolve($s->schedule, $s->tanggal->toDateString()) : null;
        $jam     = substr($waktu['jam_mulai'] ?? '', 0, 5).'–'.substr($waktu['jam_selesai'] ?? '', 0, 5);
        $kelas   = $s->schedule?->schoolClass;
        $label   = $kelas ? "{$kelas->tingkat->value} {$kelas->jurusan} {$kelas->rombel}" : '—';
        $mapel   = $s->schedule?->subject?->nama;

        return "{$tanggal} {$jam} • {$label}".($mapel ? " • {$mapel}" : '');
    }

    /** Semua notifikasi inval mengarah ke halaman yang sama; tab-nya ditentukan frontend. */
    protected function url(): string
    {
        return '/inval';
    }
}
