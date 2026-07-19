<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PklSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Saklar Mode PKL (admin). Satu baris singleton.
 */
class PklSettingController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => ['aktif' => PklSetting::isActive()]]);
    }

    public function toggle(Request $request): JsonResponse
    {
        $data = $request->validate(['aktif' => ['required', 'boolean']]);

        $setting = PklSetting::instance();
        $setting->update(['aktif' => $data['aktif']]);

        // Saklarnya di-memoize per request di PklMode — tanpa flush, respons ini masih
        // bisa memakai nilai lama saat menghitung sesuatu setelah update.
        \App\Support\PklMode::flush();

        return response()->json([
            'message' => $data['aktif'] ? 'Mode PKL diaktifkan.' : 'Mode PKL dinonaktifkan.',
            'data'    => ['aktif' => $setting->aktif],
        ]);
    }
}
