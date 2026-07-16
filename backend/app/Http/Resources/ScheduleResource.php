<?php

namespace App\Http\Resources;

use App\Models\AgendaFillSetting;
use App\Support\BellSchedule;
use App\Support\PklMode;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class ScheduleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $today = $this->relationLoaded('agendas') ? $this->agendas->first() : null;

        // Resource ini hanya dipakai utk jadwal HARI INI (ScheduleController::today) —
        // pukul efektifnya diselesaikan lewat bel + mode Apel/Tanpa Apel tanggal ini.
        $jam = BellSchedule::resolve($this->resource, now('Asia/Jakarta')->toDateString());

        // GK: dulu tidak ada info batas waktu sama sekali di sini — guru tidak tahu
        // sampai kapan boleh isi agenda hari ini kecuali sudah lewat (baru dapat error
        // pas submit). Tampilkan proaktif di halaman "Isi Agenda"/dashboard.
        $deadline = null;
        if (! $today && $jam['jam_selesai']) {
            $setting       = AgendaFillSetting::instance();
            $jadwalSelesai = Carbon::parse(now('Asia/Jakarta')->toDateString().' '.$jam['jam_selesai'], 'Asia/Jakarta');
            $deadline      = $setting->batasWaktu($jadwalSelesai)->format('Y-m-d H:i');
        }

        return [
            'id'         => $this->uuid,
            'hari'       => $this->hari->value,
            'jam_mulai'  => $jam['jam_mulai'],
            'jam_selesai'=> $jam['jam_selesai'],
            'subject'    => [
                'id'   => $this->subject->uuid,
                'kode' => $this->subject->kode,
                // Mode PKL: sesi kelas XII tampil sebagai "Praktek Kerja Lapangan".
                'nama' => PklMode::subjectLabelFor($this->resource),
            ],
            'class' => [
                'id'      => $this->schoolClass->uuid,
                'tingkat' => $this->schoolClass->tingkat->value,
                'jurusan' => $this->schoolClass->jurusan,
                'rombel'  => $this->schoolClass->rombel,
                'label'   => $this->schoolClass->label(),
            ],
            'agenda_hari_ini' => $today ? [
                'id'     => $today->uuid,
                'status' => $today->status->value,
            ] : null,
            'deadline_isi_agenda' => $deadline,
        ];
    }
}
