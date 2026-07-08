<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            // Langsung ke public/storage (bukan storage/app/public + symlink) supaya
            // tidak butuh `storage:link` — banyak shared hosting (cPanel) menonaktifkan
            // symlink() dan exec() sekaligus, jadi symlink tidak bisa dibuat sama sekali.
            //
            // Default disk ini SELALU lokal di sini. Kalau admin aktifkan R2 lewat Admin
            // Panel > Penyimpanan, disk ini dialihkan ke S3/R2 secara runtime lewat
            // AppServiceProvider::configurePublicDiskFromR2Setting() — lihat R2Setting.
            // Tidak ada jalur env (.env) untuk ini, sengaja: kredensial R2 dikelola lewat
            // UI (terenkripsi di DB), bukan file konfigurasi server.
            'root' => public_path('storage'),
            'url' => env('APP_URL').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    | Dikosongkan karena disk 'public' di atas sudah langsung menunjuk ke
    | public/storage (bukan storage/app/public), jadi tidak ada symlink yang
    | perlu dibuat — `storage:link` aman dijalankan tapi jadi no-op.
    |
    */

    'links' => [],

];
