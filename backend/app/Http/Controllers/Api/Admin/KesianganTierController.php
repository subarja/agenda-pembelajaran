<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\KesianganPointTier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Panel Admin: tier poin keterlambatan (rentang menit -> poin negatif) untuk kesiangan.
 * Disimpan sebagai daftar; PUT mengganti seluruh daftar (mirip bel per hari).
 */
class KesianganTierController extends Controller
{
    // ── GET /admin/kesiangan-tiers ───────────────────────────────────────────
    public function show(): JsonResponse
    {
        return response()->json(['data' => KesianganPointTier::orderBy('menit_min')->get()
            ->map(fn ($t) => [
                'menit_min' => $t->menit_min,
                'menit_max' => $t->menit_max,
                'poin' => $t->poin,
                'aktif' => $t->aktif,
            ])]);
    }

    // ── PUT /admin/kesiangan-tiers — ganti seluruh daftar ────────────────────
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tiers' => ['present', 'array'],
            'tiers.*.menit_min' => ['required', 'integer', 'min:0', 'max:1440'],
            'tiers.*.menit_max' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'tiers.*.poin' => ['required', 'integer', 'min:-100', 'max:0'],
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

        return response()->json(['message' => 'Tier poin keterlambatan disimpan.']);
    }
}
