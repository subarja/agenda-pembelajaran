<?php

return [

    // Lokasi folder frontend (source checkout git, bukan document root domainnya)
    // relatif terhadap backend — dipakai fitur Build Dist di Admin Panel utk cari
    // frontend/dist.zip dan tempat extract frontend/dist. Default: sibling dari
    // folder backend (struktur git clone standar proyek ini). Override lewat
    // DEPLOY_FRONTEND_PATH di .env kalau layout server Anda beda.
    'frontend_path' => env('DEPLOY_FRONTEND_PATH', dirname(base_path()).'/frontend'),

];
