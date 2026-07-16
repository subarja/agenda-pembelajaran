<?php

// Password default untuk generate akun massal (Panel Admin > Pengguna > Generate Akun).
// Sengaja TANPA nilai bawaan di kode: nilai lama yang di-hardcode sudah telanjur
// tercatat di riwayat git, jadi nilai penggantinya hanya boleh hidup di .env server.
// Bila belum diisi, endpoint generate-accounts menolak dengan pesan yang menjelaskan.
return [
    'default_teacher_password' => env('DEFAULT_TEACHER_PASSWORD'),
    'default_student_password' => env('DEFAULT_STUDENT_PASSWORD'),
];
