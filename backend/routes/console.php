<?php

use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/**
 * Hapus akun guru/siswa dummy yang dibuat oleh seeder (bukan hasil import ASc XML / Dapodik).
 * Jalankan: php artisan clean:dummy [--force]
 */
Artisan::command('clean:dummy {--force : Hapus tanpa konfirmasi}', function () {
    // Email yang pasti dibuat oleh DatabaseSeeder / FullDemoSeeder, bukan dari import
    $dummyEmails = [
        // DatabaseSeeder — guru fiktif
        'guru@smkn2cimahi.sch.id',
        'walikelas@smkn2cimahi.sch.id',
        'bk@smkn2cimahi.sch.id',
        // DatabaseSeeder — siswa fiktif
        'siswa@smkn2cimahi.sch.id',
        'budi2324002@smkn2cimahi.sch.id',
        'citra2324003@smkn2cimahi.sch.id',
        'dani2324004@smkn2cimahi.sch.id',
        'eka2324005@smkn2cimahi.sch.id',
        'fani2324006@smkn2cimahi.sch.id',
        // FullDemoSeeder — guru fiktif
        'deni@smkn2cimahi.sch.id',
        'rina@smkn2cimahi.sch.id',
        'hendra@smkn2cimahi.sch.id',
        'yuni@smkn2cimahi.sch.id',
        'ahmad.yanuar@smkn2cimahi.sch.id',
        'wahyu@smkn2cimahi.sch.id',
        'eko@smkn2cimahi.sch.id',
        'tono@smkn2cimahi.sch.id',
        'sari@smkn2cimahi.sch.id',
        'indah@smkn2cimahi.sch.id',
        'fitri.h@smkn2cimahi.sch.id',
        'rudi@smkn2cimahi.sch.id',
        'hani@smkn2cimahi.sch.id',
    ];

    // FullDemoSeeder — siswa dengan email pola s{nis}@smkn2cimahi.sch.id dan NIS 4 digit
    $dummyStudentEmails = Student::with('user')
        ->get()
        ->filter(fn ($s) => preg_match('/^s\d{7}@smkn2cimahi\.sch\.id$/', $s->user?->email ?? ''))
        ->pluck('user.email')
        ->toArray();

    $allDummy = array_unique(array_merge($dummyEmails, $dummyStudentEmails));
    $users    = User::whereIn('email', $allDummy)->get();

    if ($users->isEmpty()) {
        $this->info('Tidak ada data dummy yang ditemukan.');
        return;
    }

    $this->table(['Nama', 'Email', 'Peran'], $users->map(fn ($u) => [$u->nama, $u->email, $u->role->value]));
    $this->line("Total: {$users->count()} akun");

    if (! $this->option('force') && ! $this->confirm('Hapus semua akun di atas?')) {
        $this->warn('Dibatalkan.');
        return;
    }

    $userIds      = $users->pluck('id');
    $teacherIds   = \App\Models\Teacher::whereIn('user_id', $userIds)->pluck('id');
    $scheduleIds  = DB::table('schedules')->whereIn('teacher_id', $teacherIds)->pluck('id');
    $agendaIds    = DB::table('agendas')->whereIn('schedule_id', $scheduleIds)->pluck('id');

    DB::transaction(function () use ($userIds, $teacherIds, $agendaIds, $scheduleIds) {
        // Hapus referensi RESTRICT dari teachers terlebih dahulu
        DB::table('character_inputs')->whereIn('teacher_id', $teacherIds)->delete();
        DB::table('character_manual_notes')->whereIn('teacher_id', $teacherIds)->delete();
        DB::table('agenda_student_scores')->whereIn('teacher_id', $teacherIds)->delete();

        // Hapus referensi RESTRICT dari users
        DB::table('handling_sessions')->whereIn('handled_by', $userIds)->delete();
        DB::table('learning_objective_logs')->whereIn('changed_by', $userIds)->delete();
        DB::table('student_case_notes')->whereIn('author_id', $userIds)->delete();

        // Hapus agendas (cascade ke student_attendances, agenda_learning_objectives, dll)
        if ($agendaIds->isNotEmpty()) {
            DB::table('agendas')->whereIn('id', $agendaIds)->delete();
        }

        // Hapus schedules
        if ($scheduleIds->isNotEmpty()) {
            DB::table('schedules')->whereIn('teacher_id', $teacherIds)->delete();
        }

        // Hard delete users — FK CASCADE hapus teachers & students beserta relasinya
        DB::table('users')->whereIn('id', $userIds)->delete();
    });

    $this->info("Berhasil menghapus {$users->count()} akun dummy.");
})->purpose('Hapus data guru & siswa fiktif hasil seeder (bukan dari import ASc XML / Dapodik)');

