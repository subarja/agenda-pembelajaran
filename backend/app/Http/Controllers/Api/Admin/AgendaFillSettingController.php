<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AgendaFillSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgendaFillSettingController extends Controller
{
    // ── GET /admin/agenda-fill-settings ──────────────────────────────────────
    public function show(): JsonResponse
    {
        $s = AgendaFillSetting::instance();

        return response()->json(['data' => [
            'batas_hari' => $s->batas_hari,
            'batas_jam'  => $s->batas_jam,
        ]]);
    }

    // ── PUT /admin/agenda-fill-settings ──────────────────────────────────────
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'batas_hari' => ['required', 'integer', 'min:0', 'max:365'],
            'batas_jam'  => ['required', 'integer', 'min:0', 'max:23'],
        ]);

        $s = AgendaFillSetting::instance();
        $s->update($data);

        return response()->json([
            'message' => 'Pengaturan waktu pengisian agenda disimpan.',
            'data'    => ['batas_hari' => $s->batas_hari, 'batas_jam' => $s->batas_jam],
        ]);
    }
}
