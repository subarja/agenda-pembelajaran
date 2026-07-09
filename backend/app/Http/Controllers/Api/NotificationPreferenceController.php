<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationPreferenceController extends Controller
{
    /** GET /notification-preferences */
    public function show(Request $request): JsonResponse
    {
        $pref = NotificationPreference::for($request->user());

        // Kirim SETIAP jenis secara eksplisit (nilai efektifnya, bukan isi kolom apa
        // adanya) supaya frontend tidak perlu tahu bahwa penyimpanannya opt-out dan
        // kunci yang hilang berarti "menyala".
        $types = collect(NotificationPreference::TYPES)
            ->map(fn (string $label, string $key) => [
                'key'     => $key,
                'label'   => $label,
                'enabled' => $pref->types[$key] ?? true,
            ])
            ->values();

        return response()->json([
            'data' => [
                'push_enabled'        => $pref->push_enabled,
                'types'               => $types,
                'quiet_hours_enabled' => $pref->quiet_hours_enabled,
                'quiet_start'         => $pref->quiet_start,
                'quiet_end'           => $pref->quiet_end,
            ],
        ]);
    }

    /** PUT /notification-preferences */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'push_enabled'        => ['sometimes', 'boolean'],
            'types'               => ['sometimes', 'array'],
            'types.*'             => ['boolean'],
            'quiet_hours_enabled' => ['sometimes', 'boolean'],
            'quiet_start'         => ['sometimes', 'date_format:H:i'],
            'quiet_end'           => ['sometimes', 'date_format:H:i'],
        ]);

        // Tolak kunci jenis yang tidak dikenal, jangan diam-diam disimpan — kolom json
        // akan menumpuk sampah yang tidak pernah dibaca siapa pun.
        if (isset($data['types'])) {
            $unknown = array_diff(array_keys($data['types']), array_keys(NotificationPreference::TYPES));

            if ($unknown !== []) {
                return response()->json(['message' => 'Jenis notifikasi tidak dikenal: '.implode(', ', $unknown)], 422);
            }
        }

        $pref = NotificationPreference::for($request->user());

        if (isset($data['types'])) {
            // Gabung, bukan timpa: frontend boleh mengirim satu toggle saja.
            $data['types'] = array_merge($pref->types ?? [], $data['types']);
        }

        $pref->update($data);

        return response()->json(['message' => 'Pengaturan notifikasi disimpan.']);
    }
}
