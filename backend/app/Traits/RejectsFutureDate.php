<?php

namespace App\Traits;

use Illuminate\Support\Carbon;

/**
 * Larang pengisian tanggal yang MENDAHULUI hari ini (tanggal masa depan) untuk data yang
 * dicatat guru/wali kelas/BK — mengisi agenda/catatan/penanganan untuk tanggal yang belum
 * terjadi tidak logis. Tanggal lampau tetap boleh (backfill; dibatasi terpisah oleh deadline
 * pengisian bila ada). Memakai tanggal zona Asia/Jakarta secara eksplisit supaya tidak
 * bergeser dekat tengah malam walau APP_TIMEZONE server salah set.
 */
trait RejectsFutureDate
{
    protected function todayJakarta(): string
    {
        return Carbon::now('Asia/Jakarta')->toDateString();
    }

    /** Rule Laravel: nilai harus <= hari ini (Asia/Jakarta). */
    protected function notFutureDateRule(): string
    {
        return 'before_or_equal:'.$this->todayJakarta();
    }

    /**
     * Pesan validasi Indonesia untuk rule di atas.
     *
     * @param  string  $field  nama field (mis. 'tanggal', 'minggu_mulai')
     * @return array<string,string>
     */
    protected function notFutureDateMessages(string $field = 'tanggal'): array
    {
        return [
            $field.'.before_or_equal' => 'Tanggal tidak boleh melebihi hari ini — tidak dapat mengisi untuk tanggal yang belum terjadi.',
        ];
    }
}
