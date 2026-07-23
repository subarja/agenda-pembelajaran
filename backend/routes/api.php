<?php

use App\Http\Controllers\Api\AcademicYearSelectionController;
use App\Http\Controllers\Api\Admin\AcademicYearController;
use App\Http\Controllers\Api\Admin\AgendaFillSettingController;
use App\Http\Controllers\Api\Admin\ArchiveWriteSettingController;
use App\Http\Controllers\Api\Admin\AscXmlImportController;
use App\Http\Controllers\Api\Admin\BellAudioController;
use App\Http\Controllers\Api\Admin\BellScheduleController;
use App\Http\Controllers\Api\Admin\CalendarController;
use App\Http\Controllers\Api\Admin\CharacterAdminController;
use App\Http\Controllers\Api\Admin\ClassAdminController;
use App\Http\Controllers\Api\Admin\CredentialTransferController;
use App\Http\Controllers\Api\Admin\DapodikImportController;
use App\Http\Controllers\Api\Admin\DatabaseBackupController;
use App\Http\Controllers\Api\Admin\DeployToolController;
use App\Http\Controllers\Api\Admin\FcmSettingController;
use App\Http\Controllers\Api\Admin\ImportController;
use App\Http\Controllers\Api\Admin\KokurikulerAdminController;
use App\Http\Controllers\Api\Admin\PasswordDefaultSettingController;
use App\Http\Controllers\Api\Admin\PhotoBulkUploadController;
use App\Http\Controllers\Api\Admin\PklObjectiveController;
use App\Http\Controllers\Api\Admin\PklPlacementController;
use App\Http\Controllers\Api\Admin\PklSettingController;
use App\Http\Controllers\Api\Admin\PrintSettingController;
use App\Http\Controllers\Api\Admin\PromotionController;
use App\Http\Controllers\Api\Admin\R2SettingController;
use App\Http\Controllers\Api\Admin\ScheduleAdminController;
use App\Http\Controllers\Api\Admin\ScheduleBulkUploadController;
use App\Http\Controllers\Api\Admin\ScheduleCopyController;
use App\Http\Controllers\Api\Admin\StudentAdminController;
use App\Http\Controllers\Api\Admin\SubjectAdminController;
use App\Http\Controllers\Api\Admin\SubstitutionAdminController;
use App\Http\Controllers\Api\Admin\TeacherAdminController;
use App\Http\Controllers\Api\Admin\TeacherEwsController;
use App\Http\Controllers\Api\Admin\UserAdminController;
use App\Http\Controllers\Api\AgendaController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Admin\PiketShiftController;
use App\Http\Controllers\Api\BellPlayerController;
use App\Http\Controllers\Api\BrandingController;
use App\Http\Controllers\Api\IzinKeluarController;
use App\Http\Controllers\Api\PiketController;
use App\Http\Controllers\Api\SekuritiController;
use App\Http\Controllers\Api\CharacterController;
use App\Http\Controllers\Api\CharacterManualNoteController;
use App\Http\Controllers\Api\DailyAttendanceController;
use App\Http\Controllers\Api\EffectiveDayController;
use App\Http\Controllers\Api\EwsController;
use App\Http\Controllers\Api\KokurikulerController;
use App\Http\Controllers\Api\LearningObjectiveController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\NotificationPreferenceController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\PklController;
use App\Http\Controllers\Api\PresensiController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\PushSubscriptionController;
use App\Http\Controllers\Api\RecommendationController;
use App\Http\Controllers\Api\RekapPerkembanganController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ScheduleController;
use App\Http\Controllers\Api\StudentCaseNoteController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\StudentPhotoController;
use App\Http\Controllers\Api\StudentRekapController;
use App\Http\Controllers\Api\SubstitutionController;
use App\Http\Controllers\Api\TeacherAttendanceController;
use App\Http\Controllers\Api\WeeklyReflectionController;
use App\Models\Recommendation;
use App\Models\Student;
use App\Services\CharacterService;
use Illuminate\Support\Facades\Route;

// ── Auth (publik) — dilindungi rate limit ─────────────────────────────────────
Route::prefix('auth')->middleware('throttle:10,1')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [PasswordResetController::class, 'sendLink']);
    Route::post('/reset-password', [PasswordResetController::class, 'reset']);
});

// Daftar semester untuk dropdown di form login (publik, dibutuhkan sebelum auth)
Route::get('academic-years/pilihan', [AcademicYearSelectionController::class, 'pilihan']);

// Logo aplikasi (publik — halaman login perlu tampilkan logo sebelum auth)
Route::get('branding', [BrandingController::class, 'show']);

// ── Pemutar Bel / Kiosk (publik terbatas) ─────────────────────────────────────
// Baca jadwal bunyi hari ini bersifat publik (jam bel bukan data pribadi); menulis
// (heartbeat/log/manual) butuh token perangkat yang valid. Rate-limit ringan.
Route::prefix('bel')->middleware('throttle:120,1')->group(function () {
    Route::get('hari-ini', [BellPlayerController::class, 'hariIni']);
    Route::post('heartbeat', [BellPlayerController::class, 'heartbeat']);
    Route::post('ring-log', [BellPlayerController::class, 'ringLog']);
    Route::post('manual', [BellPlayerController::class, 'manual']);
});

// ── Protected ─────────────────────────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'password.changed'])->group(function () {

    Route::prefix('auth')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/logout-all', [AuthController::class, 'logoutAll']);
    });

    // ── Tahun Ajaran — ganti semester kerja setelah login (opsional) ───────────
    Route::post('academic-years/pilih', [AcademicYearSelectionController::class, 'pilih']);

    // ── Profil ────────────────────────────────────────────────────────────────
    Route::get('profile', [ProfileController::class, 'show']);
    Route::put('profile', [ProfileController::class, 'update']);
    Route::post('profile/photo', [ProfileController::class, 'updatePhoto']);
    Route::put('profile/password', [ProfileController::class, 'updatePassword']);
    Route::put('profile/email', [ProfileController::class, 'updateEmail']);

    // ── Jadwal ────────────────────────────────────────────────────────────────
    Route::get('schedules/today', [ScheduleController::class, 'today']);
    Route::get('schedules/this-week', [ScheduleController::class, 'thisWeek']);
    Route::get('schedules/my-week', [ScheduleController::class, 'myWeek']);
    Route::get('schedules/today-student', [ScheduleController::class, 'todayStudent']);
    Route::get('schedules/my-pdf', [ScheduleController::class, 'myPdf']);
    Route::get('beban-mengajar', [ScheduleController::class, 'bebanMengajar']);

    // ── Siswa ─────────────────────────────────────────────────────────────────
    Route::get('students', [StudentController::class, 'index']);
    Route::get('students/{uuid}/rekap', [StudentRekapController::class, 'show']);
    Route::put('students/{uuid}/rekap/rekomendasi/{rekUuid}', [StudentRekapController::class, 'updateRekomendasi']);

    // ── Foto & Profil Siswa (admin ATAU wali kelas siswa ybs — bukan siswa sendiri) ─
    Route::get('my-class/students', [StudentPhotoController::class, 'myClassStudents']);
    Route::post('students/{uuid}/photo', [StudentPhotoController::class, 'update']);
    Route::put('students/{uuid}/profile', [StudentPhotoController::class, 'updateProfile']);

    // ── Refleksi Mingguan (wali kelas saja — dijaga di controller) ─────────────
    Route::get('weekly-reflections/export', [WeeklyReflectionController::class, 'export']);
    Route::get('weekly-reflections', [WeeklyReflectionController::class, 'index']);
    Route::post('weekly-reflections', [WeeklyReflectionController::class, 'store']);
    Route::put('weekly-reflections/{uuid}', [WeeklyReflectionController::class, 'update']);
    Route::delete('weekly-reflections/{uuid}', [WeeklyReflectionController::class, 'destroy']);

    // ── Kalender & Minggu Efektif (semua role terautentikasi) ───────────────────
    Route::get('calendar/events', [CalendarController::class, 'events']);
    Route::get('effective-days/my-classes', [EffectiveDayController::class, 'myClasses']);
    Route::get('effective-days/my-minggu', [EffectiveDayController::class, 'myMinggu']);
    Route::get('effective-days/export-teacher', [EffectiveDayController::class, 'exportTeacher']);
    Route::get('effective-days/export-teacher-pdf', [EffectiveDayController::class, 'exportTeacherPdf']);
    Route::get('effective-days', [EffectiveDayController::class, 'index']);

    // ── Tujuan Pembelajaran ───────────────────────────────────────────────────
    Route::get('learning-objectives/my-contexts', [LearningObjectiveController::class, 'myContexts']);
    Route::get('learning-objectives/template', [LearningObjectiveController::class, 'template']);
    Route::post('learning-objectives/import', [LearningObjectiveController::class, 'import']);
    Route::get('learning-objectives/logs', [LearningObjectiveController::class, 'logs']);
    Route::get('learning-objectives', [LearningObjectiveController::class, 'index']);
    Route::post('learning-objectives', [LearningObjectiveController::class, 'store']);
    Route::put('learning-objectives/{uuid}', [LearningObjectiveController::class, 'update']);
    Route::delete('learning-objectives/{uuid}', [LearningObjectiveController::class, 'destroy']);

    // ── Agenda ────────────────────────────────────────────────────────────────
    Route::get('agendas/my-classes', [AgendaController::class, 'myClasses']);
    Route::get('agendas/perlu-diisi', [AgendaController::class, 'perluDiisi']);
    Route::get('agendas', [AgendaController::class, 'index']);
    Route::post('agendas', [AgendaController::class, 'store']);
    Route::get('agendas/{uuid}', [AgendaController::class, 'show']);
    Route::put('agendas/{uuid}', [AgendaController::class, 'update']);

    // ── Presensi per-Sesi KBM ────────────────────────────────────────────────
    Route::get('agendas/{uuid}/presensi', [PresensiController::class, 'index']);
    Route::post('agendas/{uuid}/presensi', [PresensiController::class, 'bulkStore']);

    // ── Presensi Harian Wali Kelas ────────────────────────────────────────────
    Route::get('daily-attendance', [DailyAttendanceController::class, 'index']);
    Route::post('daily-attendance', [DailyAttendanceController::class, 'bulkStore']);
    Route::get('daily-attendance/rekap', [DailyAttendanceController::class, 'rekap']);

    // ── Kehadiran Guru ────────────────────────────────────────────────────────
    Route::get('teacher-attendance', [TeacherAttendanceController::class, 'index']);
    Route::put('teacher-attendance/{id}', [TeacherAttendanceController::class, 'update']);

    // ── Karakter ──────────────────────────────────────────────────────────────
    Route::get('character-categories', [CharacterController::class, 'categories']);
    Route::post('character-inputs', [CharacterController::class, 'storeInput']);
    Route::get('character-inputs', [CharacterController::class, 'indexInputs']);
    Route::get('character-summary', [CharacterController::class, 'summary']);
    // Seluruh kelas — bukan hanya yang diampu; lihat docblock CharacterController::classes().
    Route::get('character/classes', [CharacterController::class, 'classes']);
    Route::get('character/students', [CharacterController::class, 'studentsByClass']);

    // ── Catatan Manual Karakter (guru submit, admin review) ───────────────────
    Route::post('character-manual-notes', [CharacterManualNoteController::class, 'store']);
    Route::get('character-manual-notes', [CharacterManualNoteController::class, 'index']);
    Route::post('character-manual-notes/nilai-tambah', [CharacterManualNoteController::class, 'storeNilaiTambah']);

    // ── PKL (guru pembimbing; rekap absen juga dipakai admin/wali kelas) ───────
    Route::get('pkl/overview', [PklController::class, 'overview']);
    Route::get('pkl/my-students', [PklController::class, 'myStudents']);
    Route::get('pkl/weeks', [PklController::class, 'weeks']);
    Route::get('pkl/agenda', [PklController::class, 'showAgenda']);
    Route::post('pkl/agenda', [PklController::class, 'storeAgenda']);
    Route::get('pkl/students/export', [PklController::class, 'exportStudents']);
    Route::get('pkl/rekap-absen/export', [PklController::class, 'exportRekapAbsen']);
    Route::post('pkl/placements', [PklController::class, 'storePlacement']);
    Route::put('pkl/placements/{uuid}', [PklController::class, 'updatePlacement']);
    Route::post('pkl/placements/{uuid}/status', [PklController::class, 'changePlacementStatus']);

    // ── Kokurikuler (fasilitator = wali kelas; siswa: refleksi + dokumen tim) ──
    Route::get('kokurikuler/overview', [KokurikulerController::class, 'overview']);
    Route::get('kokurikuler/absen', [KokurikulerController::class, 'absenShow']);
    Route::post('kokurikuler/absen', [KokurikulerController::class, 'absenStore']);
    Route::get('kokurikuler/laporan', [KokurikulerController::class, 'laporanIndex']);
    Route::post('kokurikuler/laporan', [KokurikulerController::class, 'laporanStore']);
    Route::get('kokurikuler/refleksi', [KokurikulerController::class, 'refleksiIndex']);
    Route::post('kokurikuler/refleksi', [KokurikulerController::class, 'refleksiStore']);
    Route::get('kokurikuler/tim', [KokurikulerController::class, 'timShow']);
    Route::post('kokurikuler/tim', [KokurikulerController::class, 'timStore']);
    Route::get('kokurikuler/nilai', [KokurikulerController::class, 'nilaiShow']);
    Route::post('kokurikuler/nilai', [KokurikulerController::class, 'nilaiStore']);
    Route::get('kokurikuler/nilai/export', [KokurikulerController::class, 'nilaiExport']);
    Route::get('kokurikuler/saya', [KokurikulerController::class, 'saya']);
    Route::post('kokurikuler/dokumen', [KokurikulerController::class, 'dokumenStore']);
    Route::delete('kokurikuler/dokumen/{uuid}', [KokurikulerController::class, 'dokumenDestroy']);

    // ── Catatan Kasus Siswa (BK & Wali Kelas) ─────────────────────────────────
    Route::get('student-case-notes', [StudentCaseNoteController::class, 'index']);
    Route::post('student-case-notes', [StudentCaseNoteController::class, 'store']);
    Route::put('student-case-notes/{uuid}', [StudentCaseNoteController::class, 'update']);
    Route::delete('student-case-notes/{uuid}', [StudentCaseNoteController::class, 'destroy']);

    // ── EWS ───────────────────────────────────────────────────────────────────
    Route::get('ews/export', [EwsController::class, 'export']);
    Route::get('ews', [EwsController::class, 'index']);
    Route::get('ews/{uuid}', [EwsController::class, 'show']);
    Route::get('ews/{uuid}/pdf', [EwsController::class, 'dimensionPdf']);
    Route::get('ews/{uuid}/profile-pdf', [EwsController::class, 'profilePdf']);

    // ── Laporan ───────────────────────────────────────────────────────────────
    Route::get('reports/classes', [ReportController::class, 'classes']);
    Route::get('reports/teachers', [ReportController::class, 'reportTeachers']);
    Route::get('reports/guru-contexts', [ReportController::class, 'guruContexts']);
    Route::get('reports/kehadiran', [ReportController::class, 'kehadiran']);
    Route::get('reports/karakter', [ReportController::class, 'karakter']);
    Route::get('reports/nilai_tambah', [ReportController::class, 'nilaiTambah']);
    Route::get('reports/ews', [ReportController::class, 'ews']);
    Route::get('reports/agenda', [ReportController::class, 'agenda']);

    // ── Rekap Perkembangan Siswa Lintas Semester (admin/wakasek) ─────────────
    Route::get('rekap-perkembangan', [RekapPerkembanganController::class, 'index']);
    Route::get('rekap-perkembangan/chart', [RekapPerkembanganController::class, 'chart']);
    Route::get('rekap-perkembangan/export', [RekapPerkembanganController::class, 'export']);

    // ── Rekomendasi & Penanganan ──────────────────────────────────────────────
    Route::post('students/{uuid}/case', [RecommendationController::class, 'storeManual']);
    Route::put('recommendations/{uuid}/admin-note', [RecommendationController::class, 'updateAdminNote']);
    Route::put('recommendations/{uuid}/handlers', [RecommendationController::class, 'updateHandlers']);
    Route::put('recommendations/{uuid}/verify', [RecommendationController::class, 'verify']);
    Route::put('recommendations/{uuid}/status', [RecommendationController::class, 'updateStatus']);
    Route::post('recommendations/{uuid}/sessions', [RecommendationController::class, 'storeSession']);
    Route::post('recommendations/{uuid}/sessions/upload', [RecommendationController::class, 'uploadDocumentation']);
    Route::put('recommendations/{uuid}/sessions/{sid}', [RecommendationController::class, 'updateSession']);
    Route::put('recommendations/{uuid}/sessions/{sid}/share', [RecommendationController::class, 'toggleSessionShare']);
    Route::delete('recommendations/{uuid}/sessions/{sid}', [RecommendationController::class, 'deleteSession']);
    Route::get('recommendations/wali-aktif', [RecommendationController::class, 'waliActiveCases']);
    Route::get('students/{uuid}/handling-report', [RecommendationController::class, 'handlingReport']);

    // ── Riwayat Dokumen Penanganan (admin/wakasek=semua, wali kelas=kelasnya, guru lain=miliknya) ──
    Route::get('handling-documents', [RecommendationController::class, 'documents']);
    Route::get('handling-documents/download', [RecommendationController::class, 'downloadDocument']);
    Route::get('handling-documents/download-all', [RecommendationController::class, 'downloadAllDocuments']);

    // ── Eskalasi Konseling ke BK (GK8-GK11) ────────────────────────────────────
    Route::get('bk/konseling', [RecommendationController::class, 'myKonseling']);
    Route::put('recommendations/{uuid}/ajukan-konseling', [RecommendationController::class, 'ajukanKonseling']);
    Route::put('recommendations/{uuid}/bk-terima', [RecommendationController::class, 'bkTerima']);
    Route::put('recommendations/{uuid}/bk-selesai', [RecommendationController::class, 'bkSelesai']);

    // ── Guru Inval (guru pengganti) ───────────────────────────────────────────
    // `sesi-saya` & `calon-pengganti` mendahului rute {uuid} agar tidak tertangkap sbg uuid.
    Route::get('inval/sesi-saya', [SubstitutionController::class, 'sesiSaya']);
    Route::get('inval/calon-pengganti', [SubstitutionController::class, 'calonPengganti']);
    Route::get('inval/masuk', [SubstitutionController::class, 'masuk']);
    Route::get('inval/keluar', [SubstitutionController::class, 'keluar']);
    Route::post('inval', [SubstitutionController::class, 'store']);
    Route::put('inval/{uuid}/setujui', [SubstitutionController::class, 'setujui']);
    Route::put('inval/{uuid}/tolak', [SubstitutionController::class, 'tolak']);
    Route::put('inval/{uuid}/batal', [SubstitutionController::class, 'batal']);

    // ── Notifikasi ────────────────────────────────────────────────────────────
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::put('notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::put('notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::delete('notifications/{id}', [NotificationController::class, 'destroy']);

    // ── Push Notification (Firebase) — semua role login ───────────────────────
    // `push/devices/unsubscribe` didaftarkan SEBELUM `push/devices/{id}` supaya kata
    // "unsubscribe" tidak ditangkap lebih dulu sebagai {id}.
    Route::get('push/config', [PushSubscriptionController::class, 'config']);
    Route::get('push/devices', [PushSubscriptionController::class, 'index']);
    Route::post('push/devices', [PushSubscriptionController::class, 'store']);
    Route::post('push/devices/unsubscribe', [PushSubscriptionController::class, 'unsubscribe']);
    Route::delete('push/devices/{id}', [PushSubscriptionController::class, 'destroy'])->whereNumber('id');

    Route::get('notification-preferences', [NotificationPreferenceController::class, 'show']);
    Route::put('notification-preferences', [NotificationPreferenceController::class, 'update']);

    // ── Pengaturan Cetak PDF — per-akun (GK30), semua role login boleh akses ───
    // Dulu di bawah grup admin-only karena baris settingnya GLOBAL (satu guru bisa
    // ubah format kertas semua orang) — sekarang PrintSetting::instance($userId)
    // per-user, jadi aman dibuka ke semua role.
    Route::get('print-settings', [PrintSettingController::class, 'show']);
    Route::put('print-settings', [PrintSettingController::class, 'update']);
    Route::get('print-settings/preview', [PrintSettingController::class, 'preview']);

    // ── Piket (guru piket hari itu; guard PiketAccess di dalam controller) ─────
    Route::get('piket/ringkasan', [PiketController::class, 'ringkasan']);
    Route::get('piket/pantau', [PiketController::class, 'pantau']);
    Route::get('piket/cek-kehadiran', [PiketController::class, 'cekKehadiran']);
    Route::get('piket/izin-keluar', [PiketController::class, 'izinKeluar']);
    Route::get('piket/izin-keluar/log', [PiketController::class, 'izinKeluarLog']);
    Route::post('piket/izin-keluar/{uuid}/proses', [PiketController::class, 'prosesIzinKeluar']);
    Route::get('piket/kesiangan', [PiketController::class, 'kesiangan']);
    Route::post('piket/kesiangan/{uuid}/verifikasi', [PiketController::class, 'verifikasiKesiangan']);
    Route::get('piket/absensi', [PiketController::class, 'absensi']);
    Route::post('piket/absensi', [PiketController::class, 'simpanAbsensi']);
    Route::get('piket/resume', [PiketController::class, 'resume']);
    Route::post('piket/resume', [PiketController::class, 'simpanResume']);
    Route::get('piket/resume/export', [PiketController::class, 'exportResume']);

    // ── Izin Keluar (siswa) ────────────────────────────────────────────────────
    Route::post('izin-keluar', [IzinKeluarController::class, 'store']);
    Route::get('izin-keluar/aktif', [IzinKeluarController::class, 'aktif']);
    Route::post('izin-keluar/{uuid}/batal', [IzinKeluarController::class, 'batal']);

    // ── Izin Kesiangan (siswa) ─────────────────────────────────────────────────
    Route::post('izin-kesiangan', [\App\Http\Controllers\Api\IzinKesianganController::class, 'store']);
    Route::get('izin-kesiangan/hari-ini', [\App\Http\Controllers\Api\IzinKesianganController::class, 'hariIni']);

    // ── Sekuriti (pemindai QR) ─────────────────────────────────────────────────
    Route::middleware('role:sekuriti')->group(function () {
        Route::post('sekuriti/scan', [SekuritiController::class, 'scan']);
        Route::get('sekuriti/log', [SekuritiController::class, 'log']);
    });

    // ── Admin (hanya admin & wakasek) ─────────────────────────────────────────
    Route::middleware('role:admin,wakasek')->prefix('admin')->group(function () {

        // EWS Guru
        Route::get('teacher-ews/export', [TeacherEwsController::class, 'export']);
        Route::get('teacher-ews/{teacherUuid}/sessions/export', [TeacherEwsController::class, 'sessionsExport']);
        Route::get('teacher-ews/{teacherUuid}/sessions', [TeacherEwsController::class, 'sessions']);
        Route::get('teacher-ews', [TeacherEwsController::class, 'index']);

        // Catatan Manual Karakter — admin review
        Route::get('character-manual-notes', [CharacterManualNoteController::class, 'adminIndex']);
        Route::put('character-manual-notes/{uuid}/review', [CharacterManualNoteController::class, 'adminReview']);

        // Tujuan Pembelajaran — admin revert
        Route::post('learning-objectives/revert/{uuid}', [LearningObjectiveController::class, 'adminRevert']);

        // Logo aplikasi — ganti/reset (klik logo di sidebar)
        Route::post('branding/logo', [BrandingController::class, 'updateLogo']);
        Route::delete('branding/logo', [BrandingController::class, 'destroyLogo']);

        // Penyimpanan R2 (Cloudflare object storage) — ADMIN SAJA
        Route::middleware('role:admin')->group(function () {
            Route::get('r2/settings', [R2SettingController::class, 'show']);
            Route::put('r2/settings', [R2SettingController::class, 'update']);
            Route::post('r2/test', [R2SettingController::class, 'test']);
        });

        // Guru Inval — pemantauan kurikulum
        Route::get('inval', [SubstitutionAdminController::class, 'index']);

        // Push Notification (Firebase Cloud Messaging) — ADMIN SAJA
        Route::middleware('role:admin')->group(function () {
            Route::get('fcm/settings', [FcmSettingController::class, 'show']);
            Route::put('fcm/settings', [FcmSettingController::class, 'update']);
            Route::post('fcm/test', [FcmSettingController::class, 'test']);
        });

        // Kalender Google + Hari Efektif — admin
        Route::get('calendar/settings', [CalendarController::class, 'getSettings']);
        Route::post('calendar/settings', [CalendarController::class, 'saveSettings']);
        Route::post('calendar/upload-credentials', [CalendarController::class, 'uploadCredentials']);
        Route::post('calendar/sync', [CalendarController::class, 'sync']);
        Route::get('non-effective-days', [CalendarController::class, 'listNonEffective']);
        Route::post('non-effective-days', [CalendarController::class, 'storeNonEffective']);
        Route::put('non-effective-days/{id}', [CalendarController::class, 'updateNonEffective']);
        Route::delete('non-effective-days/{id}', [CalendarController::class, 'deleteNonEffective']);
        Route::post('non-effective-days/bulk', [CalendarController::class, 'bulkNonEffective']);
        Route::post('non-effective-days/import', [CalendarController::class, 'importNonEffective']);
        Route::post('non-effective-days/auto-mark', [CalendarController::class, 'autoMarkFromEvents']);
        Route::get('non-effective-days/template', [CalendarController::class, 'templateNonEffective']);
        Route::get('non-effective-days/unmarked-count', [CalendarController::class, 'unmarkedCount']);
        Route::get('effective-days/summary', [EffectiveDayController::class, 'adminSummary']);
        Route::get('effective-days/export', [EffectiveDayController::class, 'export']);
        Route::get('effective-days/export-pdf', [EffectiveDayController::class, 'exportPdf']);
        Route::get('effective-days/umum', [EffectiveDayController::class, 'umum']);
        Route::get('effective-days/export-umum', [EffectiveDayController::class, 'exportUmum']);

        // ── Pengaturan Waktu Pengisian Agenda (batas hari/jam pasca jadwal) ────────
        Route::get('agenda-fill-settings', [AgendaFillSettingController::class, 'show']);
        Route::put('agenda-fill-settings', [AgendaFillSettingController::class, 'update']);
        // ── Password default akun guru & siswa (dipakai Generate Akun / reset) ────
        Route::middleware('role:admin')->group(function () {
            Route::get('password-defaults', [PasswordDefaultSettingController::class, 'show']);
            Route::put('password-defaults', [PasswordDefaultSettingController::class, 'update']);
        });

        Route::get('archive-write-settings', [ArchiveWriteSettingController::class, 'show']);
        Route::put('archive-write-settings', [ArchiveWriteSettingController::class, 'update']);

        // ── Jam & Bel (bel per hari, mode Apel/Tanpa Apel, pengecualian tanggal) ───
        Route::get('bell-schedule', [BellScheduleController::class, 'show']);
        Route::get('bell-schedule/template', [BellScheduleController::class, 'template']);
        Route::post('bell-schedule/import', [BellScheduleController::class, 'import']);
        Route::put('bell-schedule/periods', [BellScheduleController::class, 'updatePeriods']);
        Route::post('bell-schedule/modes', [BellScheduleController::class, 'storeMode']);
        Route::put('bell-schedule/modes/{mode}', [BellScheduleController::class, 'updateMode']);
        Route::delete('bell-schedule/modes/{mode}', [BellScheduleController::class, 'destroyMode']);
        Route::put('bell-schedule/day-defaults', [BellScheduleController::class, 'updateDayDefaults']);
        Route::post('bell-schedule/overrides', [BellScheduleController::class, 'storeOverrides']);
        Route::delete('bell-schedule/overrides/{override}', [BellScheduleController::class, 'destroyOverride']);

        // ── Bel & Audio (bank suara + pemetaan event + perangkat kiosk) ───────────
        Route::get('bell-audios', [BellAudioController::class, 'index']);
        Route::post('bell-audios', [BellAudioController::class, 'store']);
        Route::put('bell-audios/{audio}', [BellAudioController::class, 'update']);
        Route::delete('bell-audios/{audio}', [BellAudioController::class, 'destroy']);
        Route::post('bell-audios/{uuid}/restore', [BellAudioController::class, 'restore']);
        Route::put('bell-audio-maps', [BellAudioController::class, 'upsertMap']);
        Route::post('bell-custom-rings', [BellAudioController::class, 'storeCustomRing']);
        Route::put('bell-custom-rings/{ring}', [BellAudioController::class, 'updateCustomRing']);
        Route::delete('bell-custom-rings/{ring}', [BellAudioController::class, 'destroyCustomRing']);
        Route::post('bell-devices', [BellAudioController::class, 'storeDevice']);
        Route::delete('bell-devices/{device}', [BellAudioController::class, 'destroyDevice']);

        // ── Piket: pola mingguan petugas per hari × shift ─────────────────────────
        Route::get('piket/shifts', [PiketShiftController::class, 'index']);
        Route::post('piket/shifts', [PiketShiftController::class, 'store']);
        Route::put('piket/shifts/{shift}', [PiketShiftController::class, 'update']);
        Route::put('piket/shifts/{shift}/petugas', [PiketShiftController::class, 'setPetugas']);
        Route::delete('piket/shifts/{shift}', [PiketShiftController::class, 'destroy']);
        Route::get('piket/template', [PiketShiftController::class, 'template']);
        Route::post('piket/import', [PiketShiftController::class, 'import']);

        // ── Tier poin keterlambatan (kesiangan) ───────────────────────────────────
        Route::get('kesiangan-tiers', [\App\Http\Controllers\Api\Admin\KesianganTierController::class, 'show']);
        Route::put('kesiangan-tiers', [\App\Http\Controllers\Api\Admin\KesianganTierController::class, 'update']);

        // ── Mode PKL (saklar, TP khusus, penempatan) ──────────────────────────────
        Route::get('pkl/setting', [PklSettingController::class, 'show']);
        Route::put('pkl/setting', [PklSettingController::class, 'toggle']);
        Route::get('pkl/objectives', [PklObjectiveController::class, 'index']);
        Route::post('pkl/objectives', [PklObjectiveController::class, 'store']);
        Route::put('pkl/objectives/{uuid}', [PklObjectiveController::class, 'update']);
        Route::delete('pkl/objectives/{uuid}', [PklObjectiveController::class, 'destroy']);
        Route::get('pkl/placements/template', [PklPlacementController::class, 'template']);
        Route::get('pkl/placements/export', [PklPlacementController::class, 'export']);
        Route::post('pkl/placements/import', [PklPlacementController::class, 'import']);
        Route::get('pkl/placements', [PklPlacementController::class, 'index']);
        Route::post('pkl/placements', [PklPlacementController::class, 'store']);
        Route::put('pkl/placements/{uuid}', [PklPlacementController::class, 'update']);
        Route::post('pkl/placements/{uuid}/status', [PklPlacementController::class, 'changeStatus']);
        Route::delete('pkl/placements/{uuid}', [PklPlacementController::class, 'destroy']);

        // ── Kokurikuler (projek, kelas+fasilitator, dimensi, rekap) ───────────────
        Route::get('kokurikuler/dimensions/template', [KokurikulerAdminController::class, 'dimensionsTemplate']);
        Route::post('kokurikuler/dimensions/import', [KokurikulerAdminController::class, 'dimensionsImport']);
        Route::get('kokurikuler/dimensions', [KokurikulerAdminController::class, 'dimensions']);
        Route::post('kokurikuler/dimensions', [KokurikulerAdminController::class, 'storeDimension']);
        Route::put('kokurikuler/dimensions/{id}', [KokurikulerAdminController::class, 'updateDimension']);
        Route::delete('kokurikuler/dimensions/{id}', [KokurikulerAdminController::class, 'destroyDimension']);
        Route::get('kokurikuler/teacher-options', [KokurikulerAdminController::class, 'teacherOptions']);
        // Sebelum 'projects/{uuid}' agar 'export' tidak tertangkap sebagai uuid.
        Route::get('kokurikuler/projects/export', [KokurikulerAdminController::class, 'exportProjects']);
        Route::get('kokurikuler/projects', [KokurikulerAdminController::class, 'index']);
        Route::post('kokurikuler/projects', [KokurikulerAdminController::class, 'store']);
        Route::put('kokurikuler/projects/{uuid}', [KokurikulerAdminController::class, 'update']);
        Route::delete('kokurikuler/projects/{uuid}', [KokurikulerAdminController::class, 'destroy']);
        Route::post('kokurikuler/projects/{uuid}/fasilitator-reset', [KokurikulerAdminController::class, 'fasilitatorReset']);
        Route::get('kokurikuler/projects/{uuid}/fasilitator-template', [KokurikulerAdminController::class, 'fasilitatorTemplate']);
        Route::post('kokurikuler/projects/{uuid}/fasilitator-import', [KokurikulerAdminController::class, 'fasilitatorImport']);
        Route::get('kokurikuler/projects/{uuid}/rekap', [KokurikulerAdminController::class, 'rekap']);
        Route::get('kokurikuler/projects/{uuid}/export-absen', [KokurikulerAdminController::class, 'exportAbsen']);

        // Sinkronisasi rekomendasi untuk semua siswa (jalankan sekali untuk data lama)
        Route::post('sync-recommendations', function () {
            $service = app(CharacterService::class);
            $students = Student::with(['schoolClass', 'user'])->get();
            $count = 0;
            foreach ($students as $student) {
                $score = $service->calculateNetScore($student);
                $before = Recommendation::where('student_id', $student->id)->count();
                $service->checkThresholdsAndRecommend($student, $score);
                $after = Recommendation::where('student_id', $student->id)->count();
                $count += ($after - $before);
            }

            return response()->json(['message' => "Sinkronisasi selesai. {$count} rekomendasi baru dibuat.", 'total_siswa' => $students->count()]);
        });

        // Tahun Ajaran
        Route::get('academic-years', [AcademicYearController::class, 'index']);
        Route::post('academic-years', [AcademicYearController::class, 'store']);
        Route::put('academic-years/{uuid}', [AcademicYearController::class, 'update']);
        Route::delete('academic-years/{uuid}', [AcademicYearController::class, 'destroy']);

        // Wizard Naik Kelas — pergantian tahun ajaran (admin-only, dijaga di controller)
        Route::get('promotion/preview', [PromotionController::class, 'preview']);
        Route::post('promotion/execute', [PromotionController::class, 'execute']);

        // Backup, kredensial, deploy — ADMIN SAJA (penjaga di controller dipertahankan
        // sebagai lapis kedua; yang di rute ini lapis pertama yang tidak bisa terlewat
        // saat ada endpoint baru ditambahkan ke grupnya).
        Route::middleware('role:admin')->group(function () {
            Route::get('backup/download', [DatabaseBackupController::class, 'download']);
            Route::post('backup/restore', [DatabaseBackupController::class, 'restore']);

            Route::get('credentials/export', [CredentialTransferController::class, 'export']);
            Route::post('credentials/import', [CredentialTransferController::class, 'import']);

            Route::get('deploy-tools/status', [DeployToolController::class, 'status']);
            Route::post('deploy-tools/verify', [DeployToolController::class, 'verify']);
            Route::post('deploy-tools/schema-diff', [DeployToolController::class, 'schemaDiff']);
            Route::post('deploy-tools/migrate', [DeployToolController::class, 'migrate']);
            Route::post('deploy-tools/build-vendor', [DeployToolController::class, 'buildVendor']);
            Route::post('deploy-tools/build-dist', [DeployToolController::class, 'buildDist']);
            Route::post('deploy-tools/seed', [DeployToolController::class, 'seed']);
            Route::post('deploy-tools/prune-jadwal-pdf', [DeployToolController::class, 'pruneJadwalPdf']);
            Route::post('deploy-tools/deploy', [DeployToolController::class, 'deploy']);
        });

        // Guru
        Route::get('teachers', [TeacherAdminController::class, 'index']);
        Route::post('teachers', [TeacherAdminController::class, 'store']);
        Route::put('teachers/{uuid}', [TeacherAdminController::class, 'update']);
        Route::delete('teachers/{uuid}', [TeacherAdminController::class, 'destroy']);
        Route::post('teachers/{uuid}/photo', [TeacherAdminController::class, 'updatePhoto']);
        Route::post('teachers/photos/bulk', [PhotoBulkUploadController::class, 'teachers']);
        Route::post('teachers/schedules/bulk', [ScheduleBulkUploadController::class, 'teachers']);

        // Siswa
        Route::get('students', [StudentAdminController::class, 'index']);
        Route::post('students', [StudentAdminController::class, 'store']);
        Route::put('students/{uuid}', [StudentAdminController::class, 'update']);
        Route::delete('students/{uuid}', [StudentAdminController::class, 'destroy']);
        Route::post('students/photos/bulk', [PhotoBulkUploadController::class, 'students']);

        // Kelas
        Route::get('classes', [ClassAdminController::class, 'index']);
        Route::get('classes/{uuid}/roster', [ClassAdminController::class, 'roster']);
        Route::post('classes', [ClassAdminController::class, 'store']);
        Route::put('classes/{uuid}', [ClassAdminController::class, 'update']);
        Route::delete('classes/{uuid}', [ClassAdminController::class, 'destroy']);
        Route::post('classes/schedules/bulk', [ScheduleBulkUploadController::class, 'classes']);

        // Mata Pelajaran
        Route::get('subjects', [SubjectAdminController::class, 'index']);
        Route::post('subjects', [SubjectAdminController::class, 'store']);
        Route::put('subjects/{uuid}', [SubjectAdminController::class, 'update']);
        Route::delete('subjects/{uuid}', [SubjectAdminController::class, 'destroy']);

        // Jadwal
        Route::get('schedules', [ScheduleAdminController::class, 'index']);
        // Salin jadwal dari semester lain ke TA aktif — didaftarkan sebelum rute {uuid}
        Route::get('schedules/copy-preview', [ScheduleCopyController::class, 'preview']);
        Route::post('schedules/copy-from', [ScheduleCopyController::class, 'copy']);
        Route::post('schedules', [ScheduleAdminController::class, 'store']);
        Route::put('schedules/{uuid}', [ScheduleAdminController::class, 'update']);
        Route::delete('schedules/{uuid}', [ScheduleAdminController::class, 'destroy']);

        // Struktur Karakter
        Route::get('character-categories', [CharacterAdminController::class, 'indexCategories']);
        Route::post('character-categories', [CharacterAdminController::class, 'storeCategory']);
        Route::put('character-categories/{uuid}', [CharacterAdminController::class, 'updateCategory']);
        Route::delete('character-categories/{uuid}', [CharacterAdminController::class, 'destroyCategory']);

        Route::get('character-subitems', [CharacterAdminController::class, 'indexSubitems']);
        Route::post('character-subitems', [CharacterAdminController::class, 'storeSubitem']);
        Route::put('character-subitems/{uuid}', [CharacterAdminController::class, 'updateSubitem']);
        Route::delete('character-subitems/{uuid}', [CharacterAdminController::class, 'destroySubitem']);

        // Ambang Tindakan
        Route::get('action-thresholds', [CharacterAdminController::class, 'indexThresholds']);
        Route::post('action-thresholds', [CharacterAdminController::class, 'storeThreshold']);
        Route::put('action-thresholds/{uuid}', [CharacterAdminController::class, 'updateThreshold']);
        Route::delete('action-thresholds/{uuid}', [CharacterAdminController::class, 'destroyThreshold']);

        // Pengguna — ADMIN SAJA. Inilah rantai eskalasi hak yang ditemukan audit
        // 2026-07-19: wakasek membuat akun ber-role admin lalu memakai akun itu untuk
        // backup DB & ekspor kredensial. Pengelolaan akun bukan ranah kurikulum.
        Route::middleware('role:admin')->group(function () {
            Route::get('users', [UserAdminController::class, 'index']);
            Route::post('users', [UserAdminController::class, 'store']);
            Route::put('users/{uuid}', [UserAdminController::class, 'update']);
            Route::delete('users/{uuid}', [UserAdminController::class, 'destroy']);
            Route::get('users-detail', [UserAdminController::class, 'detail']);
            Route::put('users/{uuid}/reset-password', [UserAdminController::class, 'resetPassword']);
            Route::put('users/{uuid}/toggle-status', [UserAdminController::class, 'toggleStatus']);
            Route::post('generate-accounts', [UserAdminController::class, 'generateAccounts']);
        });

        // Import aSc Timetables XML
        Route::post('import/asc-xml', [AscXmlImportController::class, 'import']);

        // Import Dapodik Excel (guru & siswa)
        Route::get('import/dapodik-guru/template', [DapodikImportController::class, 'downloadTemplate']);
        Route::post('import/dapodik-guru', [DapodikImportController::class, 'importGuru']);
        Route::post('import/dapodik-siswa', [DapodikImportController::class, 'importSiswa']);

        // Template download
        Route::get('template/{entity}', [ImportController::class, 'template']);

        // Import Excel
        // Slug entity di sini WAJIB sama dengan yang dipakai ImportModal frontend dan
        // kunci config template/{entity} — dulu route ini berbahasa Inggris (students,
        // classes, ...) sementara FE mengirim slug Indonesia (siswa, kelas, ...), jadi
        // SEMUA import lewat modal generik 404 tanpa pernah ketahuan.
        Route::post('import/guru', [ImportController::class, 'importTeachers']);
        Route::post('import/siswa', [ImportController::class, 'importStudents']);
        Route::post('import/kelas', [ImportController::class, 'importClasses']);
        Route::post('import/mapel', [ImportController::class, 'importSubjects']);
        Route::post('import/jadwal', [ImportController::class, 'importSchedules']);
        Route::post('import/karakter_kategori', [ImportController::class, 'importCharacterCategories']);
        Route::post('import/karakter_subitem', [ImportController::class, 'importCharacterSubitems']);
        Route::post('import/ambang', [ImportController::class, 'importThresholds']);
        Route::post('import/wali-kelas', [ImportController::class, 'importWaliKelas']);
        Route::get('export/wali-kelas', [ImportController::class, 'exportWaliKelas']);
    });
});
