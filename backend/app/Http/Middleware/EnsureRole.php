<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (! $request->user() || ! in_array($request->user()->role->value, $roles)) {
            abort(403, 'Akses ditolak. Peran Anda tidak diizinkan.');
        }

        return $next($request);
    }
}
