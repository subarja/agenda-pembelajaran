<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\CharacterSubitem;
use App\Models\KesianganPointTier;
use App\Models\KesianganSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Panel Admin: tier poin keterlambatan (rentang menit -> poin negatif) + pemilihan
 * sub-karakter yang dipakai poin kesiangan otomatis (kode beda tiap sekolah, tak di-hardcode).
 */
class KesianganTierController extends Controller
{
    // ── GET /admin/kesiangan-tiers ───────────────────────────────────────────
    public function show(): JsonResponse
    {
        return response()->json(['data' => [
            'tiers' => KesianganPointTier::orderBy('menit_min')->get()
                ->map(fn ($t) => [
                    'menit_min' => $t->menit_min,
                    'menit_max' => $t->menit_max,
                    'poin' => $t->poin,
                    'aktif' => $t->aktif,
                ]),
            'subitem_id' => KesianganSetting::instance()->subitem_id,
            'subitems' => CharacterSubitem::where('sifat', '!=', 'positif')->orderBy('kode')->get()
                ->map(fn ($s) => ['id' => $s->id, 'label' => $s->kode.' — '.$s->deskripsi]),
        ]]);
    }

    // ── PUT /admin/kesiangan-tiers — ganti daftar tier + sub-karakter ────────
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tiers' => ['present', 'array'],
            'tiers.*.menit_min' => ['required', 'integer', 'min:0', 'max:1440'],
            'tiers.*.menit_max' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'tiers.*.poin' => ['required', 'integer', 'min:-100', 'max:0'],
            'subitem_id' => ['sometimes', 'nullable', 'integer', 'exists:character_subitems,id'],
        ]);

        KesianganPointTier::query()->delete();
        foreach ($data['tiers'] as $t) {
            KesianganPointTier::create([
                'menit_min' => $t['menit_min'],
                'menit_max' => $t['menit_max'] ?? null,
                'poin' => $t['poin'],
                'aktif' => true,
            ]);
        }

        if (array_key_exists('subitem_id', $data)) {
            KesianganSetting::instance()->update(['subitem_id' => $data['subitem_id']]);
        }

        return response()->json(['message' => 'Pengaturan kesiangan disimpan.']);
    }
}
