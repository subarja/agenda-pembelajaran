<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\CharacterSign;
use App\Enums\CharacterSifat;
use App\Http\Controllers\Controller;
use App\Models\ActionThreshold;
use App\Models\CharacterCategory;
use App\Models\CharacterSubitem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CharacterAdminController extends Controller
{
    // ── Kategori ─────────────────────────────────────────────────────────────

    public function indexCategories(): JsonResponse
    {
        $cats = CharacterCategory::withCount('subitems')
            ->orderBy('nama')
            ->get()
            ->map(fn ($c) => [
                'id'             => $c->uuid,
                'nama'           => $c->nama,
                'deskripsi'      => $c->deskripsi,
                'aktif'          => $c->aktif,
                'jumlah_subitem' => $c->subitems_count,
            ]);

        return response()->json(['data' => $cats]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nama'      => ['required', 'string', 'max:100'],
            'deskripsi' => ['nullable', 'string'],
            'aktif'     => ['boolean'],
        ]);

        $cat = CharacterCategory::create($data + ['aktif' => $data['aktif'] ?? true]);

        return response()->json(['message' => 'Kategori karakter dibuat.', 'data' => ['id' => $cat->uuid, 'nama' => $cat->nama, 'deskripsi' => $cat->deskripsi, 'aktif' => $cat->aktif]], 201);
    }

    public function updateCategory(Request $request, string $uuid): JsonResponse
    {
        $cat  = CharacterCategory::where('uuid', $uuid)->firstOrFail();
        $data = $request->validate([
            'nama'      => ['sometimes', 'string', 'max:100'],
            'deskripsi' => ['nullable', 'string'],
            'aktif'     => ['sometimes', 'boolean'],
        ]);
        $cat->update($data);

        return response()->json(['message' => 'Kategori diperbarui.', 'data' => ['id' => $cat->uuid, 'nama' => $cat->nama, 'deskripsi' => $cat->deskripsi, 'aktif' => $cat->aktif]]);
    }

    public function destroyCategory(string $uuid): JsonResponse
    {
        $cat = CharacterCategory::where('uuid', $uuid)->firstOrFail();
        abort_if($cat->subitems()->count() > 0, 422, 'Nonaktifkan atau hapus semua sub-karakter terlebih dahulu.');
        $cat->delete();

        return response()->json(['message' => 'Kategori dihapus.']);
    }

    // ── Sub-item ──────────────────────────────────────────────────────────────

    public function indexSubitems(Request $request): JsonResponse
    {
        $items = CharacterSubitem::with('category')
            ->when($request->category_id, fn ($q, $c) =>
                $q->whereHas('category', fn ($cat) => $cat->where('uuid', $c))
            )
            ->orderBy('kode')
            ->get()
            ->map(fn ($s) => $this->formatSubitem($s));

        return response()->json(['data' => $items]);
    }

    public function storeSubitem(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['required', 'string'],
            'kode'        => ['required', 'string', 'max:20', 'unique:character_subitems,kode'],
            'deskripsi'   => ['required', 'string', 'max:255'],
            'bobot'       => ['required', 'integer', 'min:1', 'max:100'],
            'sifat'       => ['required', 'in:positif,negatif,keduanya'],
            'aktif'       => ['boolean'],
        ]);

        $cat     = CharacterCategory::where('uuid', $data['category_id'])->firstOrFail();
        $subitem = CharacterSubitem::create([
            'category_id' => $cat->id,
            'kode'        => $data['kode'],
            'deskripsi'   => $data['deskripsi'],
            'bobot'       => $data['bobot'],
            'sifat'       => CharacterSifat::from($data['sifat']),
            'aktif'       => $data['aktif'] ?? true,
        ]);

        return response()->json(['message' => 'Sub-karakter dibuat.', 'data' => $this->formatSubitem($subitem->load('category'))], 201);
    }

    public function updateSubitem(Request $request, string $uuid): JsonResponse
    {
        $subitem = CharacterSubitem::where('uuid', $uuid)->firstOrFail();
        $data    = $request->validate([
            'kode'      => ['sometimes', 'string', 'max:20', 'unique:character_subitems,kode,' . $subitem->id],
            'deskripsi' => ['sometimes', 'string', 'max:255'],
            'bobot'     => ['sometimes', 'integer', 'min:1', 'max:100'],
            'sifat'     => ['sometimes', 'in:positif,negatif,keduanya'],
            'aktif'     => ['sometimes', 'boolean'],
        ]);

        if (isset($data['sifat'])) $data['sifat'] = CharacterSifat::from($data['sifat']);
        $subitem->update($data);

        return response()->json(['message' => 'Sub-karakter diperbarui.', 'data' => $this->formatSubitem($subitem->fresh('category'))]);
    }

    public function destroySubitem(string $uuid): JsonResponse
    {
        $subitem = CharacterSubitem::where('uuid', $uuid)->firstOrFail();
        // Soft-delete: preserve history
        $subitem->update(['aktif' => false]);
        $subitem->delete();

        return response()->json(['message' => 'Sub-karakter dinonaktifkan.']);
    }

    // ── Action Thresholds ─────────────────────────────────────────────────────

    public function indexThresholds(): JsonResponse
    {
        $thresholds = ActionThreshold::with('characterCategory')
            ->orderBy('sifat')->orderBy('min_point')
            ->get()
            ->map(fn ($t) => $this->formatThreshold($t));

        return response()->json(['data' => $thresholds]);
    }

    public function storeThreshold(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['nullable', 'string'],
            'min_point'   => ['required', 'integer'],
            'max_point'   => ['nullable', 'integer', 'gt:min_point'],
            'sifat'       => ['required', 'in:positif,negatif'],
            'rekomendasi' => ['required', 'string'],
            'aktif'       => ['boolean'],
        ]);

        $catId = $data['category_id']
            ? CharacterCategory::where('uuid', $data['category_id'])->value('id')
            : null;

        $threshold = ActionThreshold::create([
            'character_category_id' => $catId,
            'min_point'             => $data['min_point'],
            'max_point'             => $data['max_point'] ?? null,
            'sifat'                 => CharacterSign::from($data['sifat']),
            'rekomendasi'           => $data['rekomendasi'],
            'aktif'                 => $data['aktif'] ?? true,
        ]);

        return response()->json(['message' => 'Ambang tindakan dibuat.', 'data' => $this->formatThreshold($threshold->load('characterCategory'))], 201);
    }

    public function updateThreshold(Request $request, string $uuid): JsonResponse
    {
        $threshold = ActionThreshold::where('uuid', $uuid)->firstOrFail();
        $data      = $request->validate([
            'min_point'   => ['sometimes', 'integer'],
            'max_point'   => ['nullable', 'integer'],
            'sifat'       => ['sometimes', 'in:positif,negatif'],
            'rekomendasi' => ['sometimes', 'string'],
            'aktif'       => ['sometimes', 'boolean'],
        ]);

        if (isset($data['sifat'])) $data['sifat'] = CharacterSign::from($data['sifat']);
        $threshold->update($data);

        return response()->json(['message' => 'Ambang tindakan diperbarui.', 'data' => $this->formatThreshold($threshold->fresh('characterCategory'))]);
    }

    public function destroyThreshold(string $uuid): JsonResponse
    {
        $threshold = ActionThreshold::where('uuid', $uuid)->firstOrFail();
        $threshold->delete();

        return response()->json(['message' => 'Ambang tindakan dihapus.']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function formatSubitem(CharacterSubitem $s): array
    {
        return [
            'id'          => $s->uuid,
            'kode'        => $s->kode,
            'deskripsi'   => $s->deskripsi,
            'bobot'       => $s->bobot,
            'sifat'       => $s->sifat->value,
            'aktif'       => $s->aktif,
            'kategori'    => $s->category ? ['id' => $s->category->uuid, 'nama' => $s->category->nama] : null,
        ];
    }

    private function formatThreshold(ActionThreshold $t): array
    {
        return [
            'id'          => $t->uuid,
            'min_point'   => $t->min_point,
            'max_point'   => $t->max_point,
            'sifat'       => $t->sifat->value,
            'rekomendasi' => $t->rekomendasi,
            'aktif'       => $t->aktif,
            'kategori'    => $t->characterCategory ? ['id' => $t->characterCategory->uuid, 'nama' => $t->characterCategory->nama] : null,
        ];
    }
}
