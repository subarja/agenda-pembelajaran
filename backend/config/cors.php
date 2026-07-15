<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | File ini sebelumnya TIDAK ADA di proyek — akibatnya HandleCors middleware
    | (Illuminate\Http\Middleware\HandleCors) selalu mendapat config('cors.paths')
    | kosong, jadi tidak pernah menambahkan header Access-Control-Allow-Origin
    | sama sekali ke response API manapun. Ini tidak masalah selama frontend &
    | backend satu origin (proxy Vite di Docker dev), tapi begitu frontend & API
    | dipisah ke subdomain berbeda (mis. sipagenda.smkn2cmi.sch.id vs
    | api.agenda.smkn2cmi.sch.id di cPanel), browser MENOLAK request cross-origin
    | — gejalanya persis seperti "tidak bisa login": request POST /login sukses
    | 200 di server, tapi browser blokir JS membaca responsnya krn tidak ada
    | header CORS, jadi frontend tidak pernah menerima token & tidak bisa lanjut.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Auth aplikasi ini pakai Bearer token (Sanctum plainTextToken di response
    // JSON), BUKAN cookie session — jadi aman dibuka ke semua origin ('*').
    // Tidak ada kredensial cookie yang bisa disalahgunakan lewat CORS karena
    // memang tidak dipakai untuk request cross-origin.
    'allowed_origins' => ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
