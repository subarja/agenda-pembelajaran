<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ArchiveWriteSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Saklar global "izinkan tulis di tahun ajaran arsip (non-aktif)".
 * Default MATI — TA arsip baca-saja penuh; admin membukanya sementara untuk
 * koreksi data susulan, lalu menutupnya kembali. Kunci semester (locked) tetap
 * berlaku terpisah dan lebih kuat: TA terkunci tidak bisa ditulis apa pun.
 */
class ArchiveWriteSettingController extends Controller
{
    // GET /admin/archive-write-settings
    public function show(): JsonResponse
    {
        return response()->json(['data' => [
            'izinkan_tulis' => ArchiveWriteSetting::instance()->izinkan_tulis,
        ]]);
    }

    // PUT /admin/archive-write-settings
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate(['izinkan_tulis' => ['required', 'boolean']]);
        ArchiveWriteSetting::instance()->update($data);

        return response()->json([
            'message' => $data['izinkan_tulis']
                ? 'Akses tulis TA arsip DIBUKA. Jangan lupa menutupnya kembali setelah koreksi selesai.'
                : 'Akses tulis TA arsip ditutup — semua TA non-aktif kembali baca-saja.',
            'data' => ['izinkan_tulis' => (bool) $data['izinkan_tulis']],
        ]);
    }
}
