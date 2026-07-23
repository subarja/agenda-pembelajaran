<?php

namespace App\Services;

use App\Enums\CharacterSign;
use App\Enums\CharacterSumber;
use App\Models\CharacterInput;
use App\Models\CharacterSubitem;
use App\Models\IzinKesiangan;
use App\Models\KesianganPointTier;
use App\Models\KesianganSetting;
use Illuminate\Support\Facades\Log;

/**
 * Menerapkan poin negatif OTOMATIS untuk kesiangan ke sub-karakter KD-04 (Terlambat).
 * Proporsional (tier keterlambatan), SEKALI per (siswa, tanggal) via updateOrCreate + unique
 * (student_id, tanggal_kejadian, subitem_id). Poin dikenakan baik izin disetujui maupun
 * ditolak (keputusan user) — dipanggil saat status final oleh IzinKesianganController.
 */
class KesianganService
{
    /**
     * @return 'applied'|'no_verifier'|'not_configured'|'no_tier' — supaya pemanggil bisa
     *                                                            memberi tahu bila poin TIDAK tercatat (mis. sub-karakter belum dipilih admin),
     *                                                            bukan gagal diam-diam.
     */
    public function terapkanPoin(IzinKesiangan $izin): string
    {
        // teacher_id character_inputs NOT NULL; verifikator wajib ada saat status final.
        $teacherId = $izin->diverifikasi_oleh;
        if (! $teacherId) {
            return 'no_verifier';
        }

        // Sub-karakter terlambat DIPILIH admin (kode beda tiap sekolah), bukan hardcode 'KD-04'.
        $subitemId = KesianganSetting::instance()->subitem_id;
        $subitem = $subitemId ? CharacterSubitem::find($subitemId) : null;
        if (! $subitem) {
            Log::warning('Kesiangan: sub-karakter untuk poin otomatis belum dikonfigurasi (Admin > Piket).', [
                'izin_kesiangan_id' => $izin->id,
            ]);

            return 'not_configured'; // belum dikonfigurasi -> tidak membuat poin (tidak diam-diam salah)
        }

        $poin = KesianganPointTier::poinUntuk($izin->terlambat_menit);
        if ($poin === 0) {
            return 'no_tier'; // tidak terlambat / tak ada tier -> tak ada poin
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

        return 'applied';
    }
}
