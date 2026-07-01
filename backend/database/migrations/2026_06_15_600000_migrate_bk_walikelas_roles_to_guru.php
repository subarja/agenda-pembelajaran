<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Ubah role bk dan wali_kelas ke guru
        DB::table('users')
            ->whereIn('role', ['bk', 'wali_kelas'])
            ->update(['role' => 'guru']);

        // Auto-set is_bk dari nama mata pelajaran yang diajarkan
        $bkTeacherIds = DB::table('schedules')
            ->join('subjects', 'subjects.id', '=', 'schedules.subject_id')
            ->join('teachers', 'teachers.id', '=', 'schedules.teacher_id')
            ->where(function ($q) {
                $q->where('subjects.nama', 'ilike', '%bk%')
                  ->orWhere('subjects.nama', 'ilike', '%bimbingan%');
            })
            ->pluck('teachers.id')
            ->unique();

        if ($bkTeacherIds->isNotEmpty()) {
            DB::table('teachers')
                ->whereIn('id', $bkTeacherIds)
                ->update(['is_bk' => true]);
        }
    }

    public function down(): void
    {
        // Tidak dapat di-reverse karena tidak ada data role asal tersimpan
    }
};
