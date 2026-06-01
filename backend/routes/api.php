<?php

use App\Http\Controllers\Api\Admin\AcademicYearController;
use App\Http\Controllers\Api\Admin\TeacherEwsController;
use App\Http\Controllers\Api\Admin\CharacterAdminController;
use App\Http\Controllers\Api\Admin\ClassAdminController;
use App\Http\Controllers\Api\Admin\ScheduleAdminController;
use App\Http\Controllers\Api\Admin\StudentAdminController;
use App\Http\Controllers\Api\Admin\SubjectAdminController;
use App\Http\Controllers\Api\Admin\TeacherAdminController;
use App\Http\Controllers\Api\AgendaController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CharacterController;
use App\Http\Controllers\Api\EwsController;
use App\Http\Controllers\Api\LearningObjectiveController;
use App\Http\Controllers\Api\PresensiController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ScheduleController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\NotificationController;
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

// ── Protected ─────────────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::prefix('auth')->group(function () {
        Route::get('/me',          [AuthController::class, 'me']);
        Route::post('/logout',     [AuthController::class, 'logout']);
        Route::post('/logout-all', [AuthController::class, 'logoutAll']);
    });

    // ── Profil ────────────────────────────────────────────────────────────────
    Route::get('profile',             [ProfileController::class, 'show']);
    Route::put('profile',             [ProfileController::class, 'update']);
    Route::post('profile/photo',      [ProfileController::class, 'updatePhoto']);
    Route::put('profile/password',    [ProfileController::class, 'updatePassword']);
    Route::put('profile/email',       [ProfileController::class, 'updateEmail']);

    // ── Jadwal ────────────────────────────────────────────────────────────────
    Route::get('schedules/today',     [ScheduleController::class, 'today']);

    // ── Siswa ─────────────────────────────────────────────────────────────────
    Route::get('students',                                        [StudentController::class, 'index']);
    Route::get('students/{uuid}/rekap',                           [StudentRekapController::class, 'show']);
    Route::put('students/{uuid}/rekap/rekomendasi/{rekUuid}',     [StudentRekapController::class, 'updateRekomendasi']);

    // ── Tujuan Pembelajaran ───────────────────────────────────────────────────
    Route::get('learning-objectives/my-contexts', [LearningObjectiveController::class, 'myContexts']);
    Route::get('learning-objectives',             [LearningObjectiveController::class, 'index']);
    Route::post('learning-objectives',            [LearningObjectiveController::class, 'store']);
    Route::put('learning-objectives/{uuid}',      [LearningObjectiveController::class, 'update']);
    Route::delete('learning-objectives/{uuid}',   [LearningObjectiveController::class, 'destroy']);

    // ── Agenda ────────────────────────────────────────────────────────────────
    Route::get('agendas',             [AgendaController::class, 'index']);
    Route::post('agendas',            [AgendaController::class, 'store']);
    Route::get('agendas/{uuid}',      [AgendaController::class, 'show']);
    Route::put('agendas/{uuid}',      [AgendaController::class, 'update']);

    // ── Presensi ──────────────────────────────────────────────────────────────
    Route::get('agendas/{uuid}/presensi',  [PresensiController::class, 'index']);
    Route::post('agendas/{uuid}/presensi', [PresensiController::class, 'bulkStore']);

    // ── Kehadiran Guru ────────────────────────────────────────────────────────
    Route::get('teacher-attendance',       [TeacherAttendanceController::class, 'index']);
    Route::put('teacher-attendance/{id}',  [TeacherAttendanceController::class, 'update']);

    // ── Karakter ──────────────────────────────────────────────────────────────
    Route::get('character-categories',     [CharacterController::class, 'categories']);
    Route::post('character-inputs',        [CharacterController::class, 'storeInput']);
    Route::get('character-inputs',         [CharacterController::class, 'indexInputs']);
    Route::get('character-summary',        [CharacterController::class, 'summary']);

    // ── EWS ───────────────────────────────────────────────────────────────────
    Route::get('ews',                      [EwsController::class, 'index']);
    Route::get('ews/{uuid}',               [EwsController::class, 'show']);

    // ── Laporan ───────────────────────────────────────────────────────────────
    Route::get('reports/classes',           [ReportController::class, 'classes']);
    Route::get('reports/guru-contexts',     [ReportController::class, 'guruContexts']);
    Route::get('reports/kehadiran',         [ReportController::class, 'kehadiran']);
    Route::get('reports/karakter',          [ReportController::class, 'karakter']);
    Route::get('reports/ews',               [ReportController::class, 'ews']);
    Route::get('reports/agenda',            [ReportController::class, 'agenda']);
    Route::get('reports/jurnal',            [ReportController::class, 'jurnal']);

    // ── Rekomendasi & Penanganan ──────────────────────────────────────────────
    Route::put('recommendations/{uuid}/admin-note',       [RecommendationController::class, 'updateAdminNote']);
    Route::put('recommendations/{uuid}/handlers',         [RecommendationController::class, 'updateHandlers']);
    Route::put('recommendations/{uuid}/verify',           [RecommendationController::class, 'verify']);
    Route::put('recommendations/{uuid}/status',           [RecommendationController::class, 'updateStatus']);
    Route::post('recommendations/{uuid}/sessions',        [RecommendationController::class, 'storeSession']);
    Route::put('recommendations/{uuid}/sessions/{sid}',   [RecommendationController::class, 'updateSession']);
    Route::delete('recommendations/{uuid}/sessions/{sid}',[RecommendationController::class, 'deleteSession']);
    Route::get('students/{uuid}/handling-report',         [RecommendationController::class, 'handlingReport']);

    // ── Notifikasi ────────────────────────────────────────────────────────────
    Route::get('notifications',              [NotificationController::class, 'index']);
    Route::put('notifications/read-all',     [NotificationController::class, 'markAllRead']);
    Route::put('notifications/{id}/read',    [NotificationController::class, 'markRead']);
    Route::delete('notifications/{id}',      [NotificationController::class, 'destroy']);

    // ── Admin (hanya admin & wakasek) ─────────────────────────────────────────
    Route::middleware('role:admin,wakasek')->prefix('admin')->group(function () {

        // EWS Guru
        Route::get('teacher-ews',                 [TeacherEwsController::class, 'index']);

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

        // Guru
        Route::get('teachers',                    [TeacherAdminController::class, 'index']);
        Route::post('teachers',                   [TeacherAdminController::class, 'store']);
        Route::put('teachers/{uuid}',             [TeacherAdminController::class, 'update']);
        Route::delete('teachers/{uuid}',          [TeacherAdminController::class, 'destroy']);

        // Siswa
        Route::get('students',                    [StudentAdminController::class, 'index']);
        Route::post('students',                   [StudentAdminController::class, 'store']);
        Route::put('students/{uuid}',             [StudentAdminController::class, 'update']);
        Route::delete('students/{uuid}',          [StudentAdminController::class, 'destroy']);

        // Kelas
        Route::get('classes',                     [ClassAdminController::class, 'index']);
        Route::post('classes',                    [ClassAdminController::class, 'store']);
        Route::put('classes/{uuid}',              [ClassAdminController::class, 'update']);
        Route::delete('classes/{uuid}',           [ClassAdminController::class, 'destroy']);

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
    });
});
