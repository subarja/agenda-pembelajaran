<?php

use App\Http\Controllers\Api\Admin\AcademicYearController;
use App\Http\Controllers\Api\Admin\AgendaFillSettingController;
use App\Http\Controllers\Api\Admin\PrintSettingController;
use App\Http\Controllers\Api\AcademicYearSelectionController;
use App\Http\Controllers\Api\Admin\AscXmlImportController;
use App\Http\Controllers\Api\Admin\DapodikImportController;
use App\Http\Controllers\Api\Admin\TeacherEwsController;
use App\Http\Controllers\Api\Admin\CharacterAdminController;
use App\Http\Controllers\Api\Admin\ClassAdminController;
use App\Http\Controllers\Api\Admin\ImportController;
use App\Http\Controllers\Api\Admin\ScheduleAdminController;
use App\Http\Controllers\Api\Admin\ScheduleBulkUploadController;
use App\Http\Controllers\Api\Admin\StudentAdminController;
use App\Http\Controllers\Api\Admin\SubjectAdminController;
use App\Http\Controllers\Api\Admin\TeacherAdminController;
use App\Http\Controllers\Api\Admin\CalendarController;
use App\Http\Controllers\Api\Admin\DatabaseBackupController;
use App\Http\Controllers\Api\Admin\DeployToolController;
use App\Http\Controllers\Api\Admin\FcmSettingController;
use App\Http\Controllers\Api\Admin\R2SettingController;
use App\Http\Controllers\Api\Admin\SubstitutionAdminController;
use App\Http\Controllers\Api\Admin\UserAdminController;
use App\Http\Controllers\Api\EffectiveDayController;
use App\Http\Controllers\Api\AgendaController;
use App\Http\Controllers\Api\DailyAttendanceController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CharacterController;
use App\Http\Controllers\Api\CharacterManualNoteController;
use App\Http\Controllers\Api\EwsController;
use App\Http\Controllers\Api\StudentCaseNoteController;
use App\Http\Controllers\Api\LearningObjectiveController;
use App\Http\Controllers\Api\PresensiController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RekapPerkembanganController;
use App\Http\Controllers\Api\ScheduleController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\SubstitutionController;
use App\Http\Controllers\Api\StudentPhotoController;
use App\Http\Controllers\Api\WeeklyReflectionController;
use App\Http\Controllers\Api\Admin\PhotoBulkUploadController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\NotificationPreferenceController;
use App\Http\Controllers\Api\PushSubscriptionController;
use App\Http\Controllers\Api\RecommendationController;
use App\Http\Controllers\Api\StudentRekapController;
use App\Http\Controllers\Api\TeacherAttendanceController;
use App\Http\Controllers\Api\PasswordResetController;
use Illuminate\Support\Facades\Route;

// ── Auth (publik) — dilindungi rate limit ─────────────────────────────────────
Route::prefix('auth')->middleware('throttle:10,1')->group(function () {
    Route::post('/login',          [AuthController::class, 'login']);
    Route::post('/forgot-password',[PasswordResetController::class, 'sendLink']);
    Route::post('/reset-password', [PasswordResetController::class, 'reset']);
});

// Daftar semester untuk dropdown di form login (publik, dibutuhkan sebelum auth)
Route::get('academic-years/pilihan', [AcademicYearSelectionController::class, 'pilihan']);

// ── Protected ─────────────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::prefix('auth')->group(function () {
        Route::get('/me',          [AuthController::class, 'me']);
        Route::post('/logout',     [AuthController::class, 'logout']);
        Route::post('/logout-all', [AuthController::class, 'logoutAll']);
    });

    // ── Tahun Ajaran — ganti semester kerja setelah login (opsional) ───────────
    Route::post('academic-years/pilih',   [AcademicYearSelectionController::class, 'pilih']);

    // ── Profil ────────────────────────────────────────────────────────────────
    Route::get('profile',             [ProfileController::class, 'show']);
    Route::put('profile',             [ProfileController::class, 'update']);
    Route::post('profile/photo',      [ProfileController::class, 'updatePhoto']);
    Route::put('profile/password',    [ProfileController::class, 'updatePassword']);
    Route::put('profile/email',       [ProfileController::class, 'updateEmail']);

    // ── Jadwal ────────────────────────────────────────────────────────────────
    Route::get('schedules/today',         [ScheduleController::class, 'today']);
    Route::get('schedules/this-week',     [ScheduleController::class, 'thisWeek']);
    Route::get('schedules/today-student', [ScheduleController::class, 'todayStudent']);
    Route::get('schedules/my-pdf',        [ScheduleController::class, 'myPdf']);

    // ── Siswa ─────────────────────────────────────────────────────────────────
    Route::get('students',                                        [StudentController::class, 'index']);
    Route::get('students/{uuid}/rekap',                           [StudentRekapController::class, 'show']);
    Route::put('students/{uuid}/rekap/rekomendasi/{rekUuid}',     [StudentRekapController::class, 'updateRekomendasi']);

    // ── Foto & Profil Siswa (admin ATAU wali kelas siswa ybs — bukan siswa sendiri) ─
    Route::get('my-class/students',           [StudentPhotoController::class, 'myClassStudents']);
    Route::post('students/{uuid}/photo',      [StudentPhotoController::class, 'update']);
    Route::put('students/{uuid}/profile',     [StudentPhotoController::class, 'updateProfile']);

    // ── Refleksi Mingguan (wali kelas saja — dijaga di controller) ─────────────
    Route::get('weekly-reflections/export',   [WeeklyReflectionController::class, 'export']);
    Route::get('weekly-reflections',          [WeeklyReflectionController::class, 'index']);
    Route::post('weekly-reflections',         [WeeklyReflectionController::class, 'store']);
    Route::put('weekly-reflections/{uuid}',   [WeeklyReflectionController::class, 'update']);
    Route::delete('weekly-reflections/{uuid}',[WeeklyReflectionController::class, 'destroy']);

    // ── Kalender & Minggu Efektif (semua role terautentikasi) ───────────────────
    Route::get('calendar/events',                   [CalendarController::class, 'events']);
    Route::get('effective-days/my-classes',         [EffectiveDayController::class, 'myClasses']);
    Route::get('effective-days/my-minggu',          [EffectiveDayController::class, 'myMinggu']);
    Route::get('effective-days/export-teacher',     [EffectiveDayController::class, 'exportTeacher']);
    Route::get('effective-days/export-teacher-pdf', [EffectiveDayController::class, 'exportTeacherPdf']);
    Route::get('effective-days',                    [EffectiveDayController::class, 'index']);

    // ── Tujuan Pembelajaran ───────────────────────────────────────────────────
    Route::get('learning-objectives/my-contexts', [LearningObjectiveController::class, 'myContexts']);
    Route::get('learning-objectives/template',    [LearningObjectiveController::class, 'template']);
    Route::post('learning-objectives/import',     [LearningObjectiveController::class, 'import']);
    Route::get('learning-objectives/logs',        [LearningObjectiveController::class, 'logs']);
    Route::get('learning-objectives',             [LearningObjectiveController::class, 'index']);
    Route::post('learning-objectives',            [LearningObjectiveController::class, 'store']);
    Route::put('learning-objectives/{uuid}',      [LearningObjectiveController::class, 'update']);
    Route::delete('learning-objectives/{uuid}',   [LearningObjectiveController::class, 'destroy']);

    // ── Agenda ────────────────────────────────────────────────────────────────
    Route::get('agendas/my-classes',  [AgendaController::class, 'myClasses']);
    Route::get('agendas/perlu-diisi', [AgendaController::class, 'perluDiisi']);
    Route::get('agendas',             [AgendaController::class, 'index']);
    Route::post('agendas',            [AgendaController::class, 'store']);
    Route::get('agendas/{uuid}',      [AgendaController::class, 'show']);
    Route::put('agendas/{uuid}',      [AgendaController::class, 'update']);

    // ── Presensi per-Sesi KBM ────────────────────────────────────────────────
    Route::get('agendas/{uuid}/presensi',  [PresensiController::class, 'index']);
    Route::post('agendas/{uuid}/presensi', [PresensiController::class, 'bulkStore']);

    // ── Presensi Harian Wali Kelas ────────────────────────────────────────────
    Route::get('daily-attendance',         [DailyAttendanceController::class, 'index']);
    Route::post('daily-attendance',        [DailyAttendanceController::class, 'bulkStore']);
    Route::get('daily-attendance/rekap',   [DailyAttendanceController::class, 'rekap']);

    // ── Kehadiran Guru ────────────────────────────────────────────────────────
    Route::get('teacher-attendance',       [TeacherAttendanceController::class, 'index']);
    Route::put('teacher-attendance/{id}',  [TeacherAttendanceController::class, 'update']);

    // ── Karakter ──────────────────────────────────────────────────────────────
    Route::get('character-categories',     [CharacterController::class, 'categories']);
    Route::post('character-inputs',        [CharacterController::class, 'storeInput']);
    Route::get('character-inputs',         [CharacterController::class, 'indexInputs']);
    Route::get('character-summary',        [CharacterController::class, 'summary']);
    // Seluruh kelas — bukan hanya yang diampu; lihat docblock CharacterController::classes().
    Route::get('character/classes',        [CharacterController::class, 'classes']);
    Route::get('character/students',       [CharacterController::class, 'studentsByClass']);

    // ── Catatan Manual Karakter (guru submit, admin review) ───────────────────
    Route::post('character-manual-notes',              [CharacterManualNoteController::class, 'store']);
    Route::get('character-manual-notes',               [CharacterManualNoteController::class, 'index']);
    Route::post('character-manual-notes/nilai-tambah', [CharacterManualNoteController::class, 'storeNilaiTambah']);

    // ── Catatan Kasus Siswa (BK & Wali Kelas) ─────────────────────────────────
    Route::get('student-case-notes',                 [StudentCaseNoteController::class, 'index']);
    Route::post('student-case-notes',                [StudentCaseNoteController::class, 'store']);
    Route::put('student-case-notes/{uuid}',          [StudentCaseNoteController::class, 'update']);
    Route::delete('student-case-notes/{uuid}',       [StudentCaseNoteController::class, 'destroy']);

    // ── EWS ───────────────────────────────────────────────────────────────────
    Route::get('ews/export',               [EwsController::class, 'export']);
    Route::get('ews',                      [EwsController::class, 'index']);
    Route::get('ews/{uuid}',               [EwsController::class, 'show']);
    Route::get('ews/{uuid}/pdf',           [EwsController::class, 'dimensionPdf']);

    // ── Laporan ───────────────────────────────────────────────────────────────
    Route::get('reports/classes',           [ReportController::class, 'classes']);
    Route::get('reports/teachers',          [ReportController::class, 'reportTeachers']);
    Route::get('reports/guru-contexts',     [ReportController::class, 'guruContexts']);
    Route::get('reports/kehadiran',         [ReportController::class, 'kehadiran']);
    Route::get('reports/karakter',          [ReportController::class, 'karakter']);
    Route::get('reports/nilai_tambah',      [ReportController::class, 'nilaiTambah']);
    Route::get('reports/ews',               [ReportController::class, 'ews']);
    Route::get('reports/agenda',            [ReportController::class, 'agenda']);

    // ── Rekap Perkembangan Siswa Lintas Semester (admin/wakasek) ─────────────
    Route::get('rekap-perkembangan',        [RekapPerkembanganController::class, 'index']);
    Route::get('rekap-perkembangan/chart',  [RekapPerkembanganController::class, 'chart']);
    Route::get('rekap-perkembangan/export', [RekapPerkembanganController::class, 'export']);

    // ── Rekomendasi & Penanganan ──────────────────────────────────────────────
    Route::post('students/{uuid}/case',                   [RecommendationController::class, 'storeManual']);
    Route::put('recommendations/{uuid}/admin-note',       [RecommendationController::class, 'updateAdminNote']);
    Route::put('recommendations/{uuid}/handlers',         [RecommendationController::class, 'updateHandlers']);
    Route::put('recommendations/{uuid}/verify',           [RecommendationController::class, 'verify']);
    Route::put('recommendations/{uuid}/status',           [RecommendationController::class, 'updateStatus']);
    Route::post('recommendations/{uuid}/sessions',        [RecommendationController::class, 'storeSession']);
    Route::post('recommendations/{uuid}/sessions/upload', [RecommendationController::class, 'uploadDocumentation']);
    Route::put('recommendations/{uuid}/sessions/{sid}',   [RecommendationController::class, 'updateSession']);
    Route::put('recommendations/{uuid}/sessions/{sid}/share', [RecommendationController::class, 'toggleSessionShare']);
    Route::delete('recommendations/{uuid}/sessions/{sid}',[RecommendationController::class, 'deleteSession']);
    Route::get('recommendations/wali-aktif',              [RecommendationController::class, 'waliActiveCases']);
    Route::get('students/{uuid}/handling-report',         [RecommendationController::class, 'handlingReport']);

    // ── Riwayat Dokumen Penanganan (admin/wakasek=semua, wali kelas=kelasnya, guru lain=miliknya) ──
    Route::get('handling-documents',                      [RecommendationController::class, 'documents']);
    Route::get('handling-documents/download',              [RecommendationController::class, 'downloadDocument']);
    Route::get('handling-documents/download-all',          [RecommendationController::class, 'downloadAllDocuments']);

    // ── Eskalasi Konseling ke BK (GK8-GK11) ────────────────────────────────────
    Route::get('bk/konseling',                             [RecommendationController::class, 'myKonseling']);
    Route::put('recommendations/{uuid}/ajukan-konseling',  [RecommendationController::class, 'ajukanKonseling']);
    Route::put('recommendations/{uuid}/bk-terima',         [RecommendationController::class, 'bkTerima']);
    Route::put('recommendations/{uuid}/bk-selesai',        [RecommendationController::class, 'bkSelesai']);

    // ── Guru Inval (guru pengganti) ───────────────────────────────────────────
    // `sesi-saya` & `calon-pengganti` mendahului rute {uuid} agar tidak tertangkap sbg uuid.
    Route::get('inval/sesi-saya',            [SubstitutionController::class, 'sesiSaya']);
    Route::get('inval/calon-pengganti',      [SubstitutionController::class, 'calonPengganti']);
    Route::get('inval/masuk',                [SubstitutionController::class, 'masuk']);
    Route::get('inval/keluar',               [SubstitutionController::class, 'keluar']);
    Route::post('inval',                     [SubstitutionController::class, 'store']);
    Route::put('inval/{uuid}/setujui',       [SubstitutionController::class, 'setujui']);
    Route::put('inval/{uuid}/tolak',         [SubstitutionController::class, 'tolak']);
    Route::put('inval/{uuid}/batal',         [SubstitutionController::class, 'batal']);

    // ── Notifikasi ────────────────────────────────────────────────────────────
    Route::get('notifications',              [NotificationController::class, 'index']);
    Route::put('notifications/read-all',     [NotificationController::class, 'markAllRead']);
    Route::put('notifications/{id}/read',    [NotificationController::class, 'markRead']);
    Route::delete('notifications/{id}',      [NotificationController::class, 'destroy']);

    // ── Push Notification (Firebase) — semua role login ───────────────────────
    // `push/devices/unsubscribe` didaftarkan SEBELUM `push/devices/{id}` supaya kata
    // "unsubscribe" tidak ditangkap lebih dulu sebagai {id}.
    Route::get('push/config',                    [PushSubscriptionController::class, 'config']);
    Route::get('push/devices',                   [PushSubscriptionController::class, 'index']);
    Route::post('push/devices',                  [PushSubscriptionController::class, 'store']);
    Route::post('push/devices/unsubscribe',      [PushSubscriptionController::class, 'unsubscribe']);
    Route::delete('push/devices/{id}',           [PushSubscriptionController::class, 'destroy'])->whereNumber('id');

    Route::get('notification-preferences',       [NotificationPreferenceController::class, 'show']);
    Route::put('notification-preferences',       [NotificationPreferenceController::class, 'update']);

    // ── Pengaturan Cetak PDF — per-akun (GK30), semua role login boleh akses ───
    // Dulu di bawah grup admin-only karena baris settingnya GLOBAL (satu guru bisa
    // ubah format kertas semua orang) — sekarang PrintSetting::instance($userId)
    // per-user, jadi aman dibuka ke semua role.
    Route::get('print-settings',             [PrintSettingController::class, 'show']);
    Route::put('print-settings',             [PrintSettingController::class, 'update']);
    Route::get('print-settings/preview',     [PrintSettingController::class, 'preview']);

    // ── Admin (hanya admin & wakasek) ─────────────────────────────────────────
    Route::middleware('role:admin,wakasek')->prefix('admin')->group(function () {

        // EWS Guru
        Route::get('teacher-ews/export',                    [TeacherEwsController::class, 'export']);
        Route::get('teacher-ews/{teacherUuid}/sessions/export', [TeacherEwsController::class, 'sessionsExport']);
        Route::get('teacher-ews/{teacherUuid}/sessions',    [TeacherEwsController::class, 'sessions']);
        Route::get('teacher-ews',                           [TeacherEwsController::class, 'index']);

        // Catatan Manual Karakter — admin review
        Route::get('character-manual-notes',                    [CharacterManualNoteController::class, 'adminIndex']);
        Route::put('character-manual-notes/{uuid}/review',      [CharacterManualNoteController::class, 'adminReview']);

        // Tujuan Pembelajaran — admin revert
        Route::post('learning-objectives/revert/{uuid}',        [LearningObjectiveController::class, 'adminRevert']);

        // Penyimpanan R2 (Cloudflare object storage) — admin
        Route::get('r2/settings',                               [R2SettingController::class, 'show']);
        Route::put('r2/settings',                               [R2SettingController::class, 'update']);
        Route::post('r2/test',                                  [R2SettingController::class, 'test']);

        // Guru Inval — pemantauan kurikulum
        Route::get('inval', [SubstitutionAdminController::class, 'index']);

        // Push Notification (Firebase Cloud Messaging) — admin
        Route::get('fcm/settings',                              [FcmSettingController::class, 'show']);
        Route::put('fcm/settings',                              [FcmSettingController::class, 'update']);
        Route::post('fcm/test',                                 [FcmSettingController::class, 'test']);

        // Kalender Google + Hari Efektif — admin
        Route::get('calendar/settings',                         [CalendarController::class, 'getSettings']);
        Route::post('calendar/settings',                        [CalendarController::class, 'saveSettings']);
        Route::post('calendar/upload-credentials',              [CalendarController::class, 'uploadCredentials']);
        Route::post('calendar/sync',                            [CalendarController::class, 'sync']);
        Route::get('non-effective-days',                        [CalendarController::class, 'listNonEffective']);
        Route::post('non-effective-days',                       [CalendarController::class, 'storeNonEffective']);
        Route::put('non-effective-days/{id}',                   [CalendarController::class, 'updateNonEffective']);
        Route::delete('non-effective-days/{id}',                [CalendarController::class, 'deleteNonEffective']);
        Route::post('non-effective-days/bulk',                  [CalendarController::class, 'bulkNonEffective']);
        Route::post('non-effective-days/import',                [CalendarController::class, 'importNonEffective']);
        Route::post('non-effective-days/auto-mark',             [CalendarController::class, 'autoMarkFromEvents']);
        Route::get('non-effective-days/template',               [CalendarController::class, 'templateNonEffective']);
        Route::get('non-effective-days/unmarked-count',         [CalendarController::class, 'unmarkedCount']);
        Route::get('effective-days/summary',                    [EffectiveDayController::class, 'adminSummary']);
        Route::get('effective-days/export',                     [EffectiveDayController::class, 'export']);
        Route::get('effective-days/export-pdf',                 [EffectiveDayController::class, 'exportPdf']);
        Route::get('effective-days/umum',                       [EffectiveDayController::class, 'umum']);
        Route::get('effective-days/export-umum',                [EffectiveDayController::class, 'exportUmum']);

        // ── Pengaturan Waktu Pengisian Agenda (batas hari/jam pasca jadwal) ────────
        Route::get('agenda-fill-settings',                      [AgendaFillSettingController::class, 'show']);
        Route::put('agenda-fill-settings',                      [AgendaFillSettingController::class, 'update']);

        // Sinkronisasi rekomendasi untuk semua siswa (jalankan sekali untuk data lama)
        Route::post('sync-recommendations',        function () {
            $service  = app(\App\Services\CharacterService::class);
            $students = \App\Models\Student::with(['schoolClass', 'user'])->get();
            $count    = 0;
            foreach ($students as $student) {
                $score = $service->calculateNetScore($student);
                $before = \App\Models\Recommendation::where('student_id', $student->id)->count();
                $service->checkThresholdsAndRecommend($student, $score);
                $after = \App\Models\Recommendation::where('student_id', $student->id)->count();
                $count += ($after - $before);
            }
            return response()->json(['message' => "Sinkronisasi selesai. {$count} rekomendasi baru dibuat.", 'total_siswa' => $students->count()]);
        });

        // Tahun Ajaran
        Route::get('academic-years',              [AcademicYearController::class, 'index']);
        Route::post('academic-years',             [AcademicYearController::class, 'store']);
        Route::put('academic-years/{uuid}',       [AcademicYearController::class, 'update']);
        Route::delete('academic-years/{uuid}',    [AcademicYearController::class, 'destroy']);

        // Backup & Restore (admin-only, dijaga lagi di dalam controller)
        Route::get('backup/download',             [DatabaseBackupController::class, 'download']);
        Route::post('backup/restore',             [DatabaseBackupController::class, 'restore']);

        // Tools Deploy & Maintenance — cPanel tanpa Terminal (admin-only, dijaga di controller)
        Route::get('deploy-tools/status',         [DeployToolController::class, 'status']);
        Route::post('deploy-tools/migrate',       [DeployToolController::class, 'migrate']);
        Route::post('deploy-tools/build-vendor',  [DeployToolController::class, 'buildVendor']);
        Route::post('deploy-tools/build-dist',    [DeployToolController::class, 'buildDist']);
        Route::post('deploy-tools/seed',          [DeployToolController::class, 'seed']);
        Route::post('deploy-tools/deploy',        [DeployToolController::class, 'deploy']);

        // Guru
        Route::get('teachers',                    [TeacherAdminController::class, 'index']);
        Route::post('teachers',                   [TeacherAdminController::class, 'store']);
        Route::put('teachers/{uuid}',             [TeacherAdminController::class, 'update']);
        Route::delete('teachers/{uuid}',          [TeacherAdminController::class, 'destroy']);
        Route::post('teachers/{uuid}/photo',      [TeacherAdminController::class, 'updatePhoto']);
        Route::post('teachers/photos/bulk',       [PhotoBulkUploadController::class, 'teachers']);
        Route::post('teachers/schedules/bulk',    [ScheduleBulkUploadController::class, 'teachers']);

        // Siswa
        Route::get('students',                    [StudentAdminController::class, 'index']);
        Route::post('students',                   [StudentAdminController::class, 'store']);
        Route::put('students/{uuid}',             [StudentAdminController::class, 'update']);
        Route::delete('students/{uuid}',          [StudentAdminController::class, 'destroy']);
        Route::post('students/photos/bulk',       [PhotoBulkUploadController::class, 'students']);

        // Kelas
        Route::get('classes',                     [ClassAdminController::class, 'index']);
        Route::post('classes',                    [ClassAdminController::class, 'store']);
        Route::put('classes/{uuid}',              [ClassAdminController::class, 'update']);
        Route::delete('classes/{uuid}',           [ClassAdminController::class, 'destroy']);
        Route::post('classes/schedules/bulk',     [ScheduleBulkUploadController::class, 'classes']);

        // Mata Pelajaran
        Route::get('subjects',                    [SubjectAdminController::class, 'index']);
        Route::post('subjects',                   [SubjectAdminController::class, 'store']);
        Route::put('subjects/{uuid}',             [SubjectAdminController::class, 'update']);
        Route::delete('subjects/{uuid}',          [SubjectAdminController::class, 'destroy']);

        // Jadwal
        Route::get('schedules',                   [ScheduleAdminController::class, 'index']);
        Route::post('schedules',                  [ScheduleAdminController::class, 'store']);
        Route::put('schedules/{uuid}',            [ScheduleAdminController::class, 'update']);
        Route::delete('schedules/{uuid}',         [ScheduleAdminController::class, 'destroy']);

        // Struktur Karakter
        Route::get('character-categories',        [CharacterAdminController::class, 'indexCategories']);
        Route::post('character-categories',       [CharacterAdminController::class, 'storeCategory']);
        Route::put('character-categories/{uuid}', [CharacterAdminController::class, 'updateCategory']);
        Route::delete('character-categories/{uuid}', [CharacterAdminController::class, 'destroyCategory']);

        Route::get('character-subitems',          [CharacterAdminController::class, 'indexSubitems']);
        Route::post('character-subitems',         [CharacterAdminController::class, 'storeSubitem']);
        Route::put('character-subitems/{uuid}',   [CharacterAdminController::class, 'updateSubitem']);
        Route::delete('character-subitems/{uuid}',[CharacterAdminController::class, 'destroySubitem']);

        // Ambang Tindakan
        Route::get('action-thresholds',           [CharacterAdminController::class, 'indexThresholds']);
        Route::post('action-thresholds',          [CharacterAdminController::class, 'storeThreshold']);
        Route::put('action-thresholds/{uuid}',    [CharacterAdminController::class, 'updateThreshold']);
        Route::delete('action-thresholds/{uuid}', [CharacterAdminController::class, 'destroyThreshold']);

        // Pengguna (admin, bk, orang_tua)
        Route::get('users',                          [UserAdminController::class, 'index']);
        Route::post('users',                         [UserAdminController::class, 'store']);
        Route::put('users/{uuid}',                   [UserAdminController::class, 'update']);
        Route::delete('users/{uuid}',                [UserAdminController::class, 'destroy']);
        // Pengguna — sub-menu detail (semua role)
        Route::get('users-detail',                   [UserAdminController::class, 'detail']);
        Route::put('users/{uuid}/reset-password',    [UserAdminController::class, 'resetPassword']);
        Route::put('users/{uuid}/toggle-status',     [UserAdminController::class, 'toggleStatus']);
        Route::post('generate-accounts',             [UserAdminController::class, 'generateAccounts']);

        // Import aSc Timetables XML
        Route::post('import/asc-xml',         [AscXmlImportController::class, 'import']);

        // Import Dapodik Excel (guru & siswa)
        Route::get('import/dapodik-guru/template', [DapodikImportController::class, 'downloadTemplate']);
        Route::post('import/dapodik-guru',    [DapodikImportController::class, 'importGuru']);
        Route::post('import/dapodik-siswa',   [DapodikImportController::class, 'importSiswa']);

        // Template download
        Route::get('template/{entity}',  [ImportController::class, 'template']);

        // Import Excel
        Route::post('import/teachers',              [ImportController::class, 'importTeachers']);
        Route::post('import/students',              [ImportController::class, 'importStudents']);
        Route::post('import/classes',               [ImportController::class, 'importClasses']);
        Route::post('import/subjects',              [ImportController::class, 'importSubjects']);
        Route::post('import/schedules',             [ImportController::class, 'importSchedules']);
        Route::post('import/character-categories',  [ImportController::class, 'importCharacterCategories']);
        Route::post('import/character-subitems',    [ImportController::class, 'importCharacterSubitems']);
        Route::post('import/thresholds',            [ImportController::class, 'importThresholds']);
        Route::post('import/wali-kelas',            [ImportController::class, 'importWaliKelas']);
        Route::get('export/wali-kelas',             [ImportController::class, 'exportWaliKelas']);
    });
});
