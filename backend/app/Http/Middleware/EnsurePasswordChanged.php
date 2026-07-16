<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordChanged
{
    /**
     * Rute yang tetap boleh diakses selama user masih wajib ganti password —
     * cukup untuk melihat identitas sendiri, mengganti password, dan keluar.
     */
    private const ALLOWED_PATHS = [
        'api/v1/auth/me',
        'api/v1/auth/logout',
        'api/v1/auth/logout-all',
        'api/v1/profile/password',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->must_change_password && ! in_array($request->path(), self::ALLOWED_PATHS, true)) {
            return response()->json([
                'message' => 'Anda wajib mengganti password terlebih dahulu sebelum melanjutkan.',
                'code'    => 'must_change_password',
            ], 403);
        }

        return $next($request);
    }
}
