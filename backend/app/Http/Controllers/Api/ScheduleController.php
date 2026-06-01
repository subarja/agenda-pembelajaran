<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ScheduleResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ScheduleController extends Controller
{
    public function today(Request $request): JsonResponse
    {
        $teacher = $request->user()->teacher;

        if (! $teacher) {
            return response()->json(['data' => []]);
        }

        $hariMap = [
            0 => 'minggu', 1 => 'senin', 2 => 'selasa',
            3 => 'rabu',   4 => 'kamis', 5 => 'jumat', 6 => 'sabtu',
        ];
        $today = $hariMap[Carbon::now('Asia/Jakarta')->dayOfWeek];
        $todayDate = Carbon::now('Asia/Jakarta')->toDateString();

        $schedules = $teacher->schedules()
            ->where('hari', $today)
            ->where('aktif', true)
            ->with([
                'subject',
                'schoolClass',
                'agendas' => fn ($q) => $q->whereDate('tanggal', $todayDate),
            ])
            ->orderBy('jam_mulai')
            ->get();

        return response()->json([
            'data' => ScheduleResource::collection($schedules),
        ]);
    }
}
