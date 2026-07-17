<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BrandingSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Logo aplikasi. show() publik (dipakai halaman login sebelum auth);
 * updateLogo()/destroyLogo() khusus admin via route middleware.
 */
class BrandingController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => ['logo_url' => BrandingSetting::instance()->logoUrl()]]);
    }

    public function updateLogo(Request $request): JsonResponse
    {
        $request->validate([
            'logo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
        ], [
            'logo.mimes' => 'Format logo harus PNG, JPG, atau WebP.',
            'logo.max'   => 'Ukuran logo maksimal 2 MB.',
        ]);

        $setting = BrandingSetting::instance();

        if ($setting->logo_path && Storage::disk('public')->exists($setting->logo_path)) {
            Storage::disk('public')->delete($setting->logo_path);
        }

        $path = $request->file('logo')->store('branding', 'public');
        $setting->update(['logo_path' => $path]);

        return response()->json([
            'message' => 'Logo berhasil diganti.',
            'data'    => ['logo_url' => $setting->logoUrl()],
        ]);
    }

    public function destroyLogo(): JsonResponse
    {
        $setting = BrandingSetting::instance();

        if ($setting->logo_path && Storage::disk('public')->exists($setting->logo_path)) {
            Storage::disk('public')->delete($setting->logo_path);
        }
        $setting->update(['logo_path' => null]);

        return response()->json([
            'message' => 'Logo dikembalikan ke bawaan.',
            'data'    => ['logo_url' => null],
        ]);
    }
}
