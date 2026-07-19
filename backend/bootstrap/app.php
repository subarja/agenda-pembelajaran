<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Laravel memasang `redirectGuestsTo(fn () => route('login'))` sebagai bawaan, dan
        // Authenticate mengevaluasinya DI DALAM middleware setiap kali permintaan tak
        // terotentikasi tidak mengirim `Accept: application/json`. Aplikasi ini API-only —
        // tidak punya rute bernama `login` — sehingga yang terlempar RouteNotFoundException
        // (500, berikut stack trace saat APP_DEBUG hidup), bukan AuthenticationException.
        // Dikembalikan null supaya jatuh ke perender 401 JSON di bawah.
        $middleware->redirectGuestsTo(fn () => null);

        $middleware->alias([
            'role'             => \App\Http\Middleware\EnsureRole::class,
            'password.changed' => \App\Http\Middleware\EnsurePasswordChanged::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Aplikasi ini API-only: tidak ada rute bernama `login`. Tanpa penjaga ini, permintaan
        // tak terotentikasi yang TIDAK mengirim `Accept: application/json` masuk ke jalur
        // redirect-tamu bawaan Laravel dan meledak jadi 500 `Route [login] not defined` —
        // membocorkan stack trace + path server saat APP_DEBUG hidup. Balas 401 apa adanya.
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, $request) {
            return response()->json([
                'message' => 'Belum terotentikasi. Silakan masuk kembali.',
            ], 401);
        });

        $exceptions->render(function (\Illuminate\Http\Exceptions\ThrottleRequestsException $e, $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                $retryAfter = $e->getHeaders()['Retry-After'] ?? 60;
                return response()->json([
                    'message' => "Terlalu banyak percobaan. Silakan coba lagi dalam {$retryAfter} detik.",
                    'retry_after' => (int) $retryAfter,
                ], 429);
            }
        });
    })->create();
