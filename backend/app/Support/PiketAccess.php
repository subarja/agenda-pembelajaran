<?php

namespace App\Support;

use App\Models\PiketAssignment;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Otorisasi piket berbasis KAPABILITAS (meniru App\Support\ClassAccess & PklMode::isPembimbing):
 * guru piket = guru yang PUNYA penugasan pada tanggal itu (scope TA aktif). Bukan cek role.
 */
class PiketAccess
{
    /** Tanggal default = hari ini (Asia/Jakarta). */
    public static function isPetugas(User $user, ?string $tanggal = null): bool
    {
        $teacher = $user->teacher ?? Teacher::where('user_id', $user->id)->first();
        if (! $teacher) {
            return false;
        }

        $tanggal ??= Carbon::now('Asia/Jakarta')->toDateString();

        return PiketAssignment::tahunAjaran()
            ->where('tanggal', $tanggal)
            ->where('teacher_id', $teacher->id)
            ->exists();
    }

    /** Akun user (guru) yang bertugas piket pada tanggal itu — untuk notifikasi. */
    public static function petugasUsers(?string $tanggal = null): Collection
    {
        $tanggal ??= Carbon::now('Asia/Jakarta')->toDateString();

        return PiketAssignment::tahunAjaran()
            ->where('tanggal', $tanggal)
            ->with('teacher.user')
            ->get()
            ->map(fn ($a) => $a->teacher?->user)
            ->filter()
            ->unique('id')
            ->values();
    }

    /** Id penugasan piket milik user pada tanggal (untuk kapabilitas & audit). */
    public static function assignmentIds(User $user, ?string $tanggal = null): array
    {
        $teacher = $user->teacher ?? Teacher::where('user_id', $user->id)->first();
        if (! $teacher) {
            return [];
        }

        $tanggal ??= Carbon::now('Asia/Jakarta')->toDateString();

        return PiketAssignment::tahunAjaran()
            ->where('tanggal', $tanggal)
            ->where('teacher_id', $teacher->id)
            ->pluck('id')->all();
    }
}
