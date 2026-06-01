<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    // GET /notifications?unread=1
    public function index(Request $request): JsonResponse
    {
        $user  = $request->user();
        $query = $user->notifications()->latest();

        if ($request->boolean('unread')) {
            $query->whereNull('read_at');
        }

        $notifications = $query->limit(30)->get()->map(fn ($n) => [
            'id'         => $n->id,
            'type'       => $n->data['type'] ?? 'info',
            'title'      => $n->data['title'] ?? '',
            'body'       => $n->data['body'] ?? '',
            'url'        => $n->data['url'] ?? null,
            'data'       => $n->data,
            'read'       => ! is_null($n->read_at),
            'created_at' => $n->created_at->diffForHumans(),
        ]);

        $unreadCount = $user->unreadNotifications()->count();

        return response()->json([
            'data'         => $notifications,
            'unread_count' => $unreadCount,
        ]);
    }

    // PUT /notifications/{id}/read
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notif = $request->user()->notifications()->find($id);
        $notif?->markAsRead();

        return response()->json(['message' => 'Notifikasi ditandai sudah dibaca.']);
    }

    // PUT /notifications/read-all
    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json(['message' => 'Semua notifikasi ditandai sudah dibaca.']);
    }

    // DELETE /notifications/{id}
    public function destroy(Request $request, string $id): JsonResponse
    {
        $request->user()->notifications()->where('id', $id)->delete();

        return response()->json(['message' => 'Notifikasi dihapus.']);
    }
}
