<?php

namespace App\Services;

use App\Enums\CharacterSign;
use App\Enums\CharacterSumber;
use App\Models\CharacterInput;
use App\Models\CharacterSubitem;
use App\Models\IzinKesiangan;
use App\Models\KesianganPointTier;

/**
 * Menerapkan poin negatif OTOMATIS untuk kesiangan ke sub-karakter KD-04 (Terlambat).
 * Proporsional (tier keterlambatan), SEKALI per (siswa, tanggal) via updateOrCreate + unique
 * (student_id, tanggal_kejadian, subitem_id). Poin dikenakan baik izin disetujui maupun
 * ditolak (keputusan user) — dipanggil saat status final oleh IzinKesianganController.
 */
class KesianganService
{
    public function terapkanPoin(IzinKesiangan $izin): void
    {
        // teacher_id character_inputs NOT NULL; verifikator wajib ada saat status final.
        $teacherId = $izin->diverifikasi_oleh;
        if (! $teacherId) {
            return;
        }

        $subitem = CharacterSubitem::where('kode', 'KD-04')->first();
        if (! $subitem) {
            return; // sekolah belum mengonfigurasi sub-karakter Terlambat
        }

        $poin = KesianganPointTier::poinUntuk($izin->terlambat_menit);
        if ($poin === 0) {
            return; // tidak terlambat / tak ada tier -> tak ada poin
        }

        $input = CharacterInput::updateOrCreate(
            [
                'student_id' => $izin->student_id,
                'tanggal_kejadian' => $izin->tanggal->toDateString(),
                'subitem_id' => $subitem->id,
            ],
            [
                'teacher_id' => $teacherId,
                'sign' => CharacterSign::Negatif,
                'sumber' => CharacterSumber::Sistem,
                'poin_override' => $poin,
                'catatan' => "Kesiangan {$izin->terlambat_menit} menit (otomatis)",
            ],
        );

        $izin->forceFill(['character_input_id' => $input->id])->saveQuietly();

        app(CharacterService::class)->processAfterInput($izin->student->load('schoolClass'));
    }
}
