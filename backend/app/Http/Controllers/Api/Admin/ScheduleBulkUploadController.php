<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SchoolClass;
use App\Models\Teacher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Upload masal jadwal (file PDF resmi, mis. hasil export aSc) — admin browse banyak file
 * sekaligus. Guru: nama file "NIP-Nama.pdf", dicocokkan lewat NIP di awal nama file. Kelas:
 * nama file "Tingkat-KodeJurusan-Rombel.pdf" (mis. "XII-RPL-A.pdf"), dicocokkan lewat
 * tingkat + rombel + "Inisial Kelas" (kolom `kode` di program_keahlians). File yang tidak
 * match / rusak / salah format dilaporkan di rekap "gagal", tidak membatalkan file lain —
 * pola sama seperti PhotoBulkUploadController.
 */
class ScheduleBulkUploadController extends Controller
{
    private const MAX_KB = 10240; // 10MB — cukup longgar untuk 1 PDF jadwal beberapa halaman

    // POST /admin/teachers/schedules/bulk — nama file = "NIP-Nama.pdf"
    public function teachers(Request $request): JsonResponse
    {
        $request->validate(['files' => ['required', 'array', 'min:1']]);

        $berhasil = [];
        $gagal    = [];

        foreach ($request->file('files', []) as $file) {
            $filename = $file->getClientOriginalName();

            if ($err = $this->validateFile($file)) {
                $gagal[] = ['file' => $filename, 'alasan' => $err];
                continue;
            }

            $base = pathinfo($filename, PATHINFO_FILENAME);
            $nip  = preg_replace('/\D/', '', explode('-', $base)[0] ?? '');

            if ($nip === '') {
                $gagal[] = ['file' => $filename, 'alasan' => 'Nama file harus diawali NIP (format "NIP-Nama.pdf").'];
                continue;
            }

            $teacher = Teacher::where('nip', $nip)->with('user')->first();
            if (! $teacher) {
                $gagal[] = ['file' => $filename, 'alasan' => "Tidak ada guru dengan NIP \"{$nip}\"."];
                continue;
            }

            if ($teacher->jadwal_pdf && Storage::disk('public')->exists($teacher->jadwal_pdf)) {
                Storage::disk('public')->delete($teacher->jadwal_pdf);
            }
            $path = $file->store('jadwal_guru', 'public');
            $teacher->update(['jadwal_pdf' => $path]);

            $berhasil[] = ['file' => $filename, 'nama' => $teacher->user->nama, 'nip' => $nip];
        }

        return response()->json($this->buildResponse('guru', $berhasil, $gagal));
    }

    // POST /admin/classes/schedules/bulk — nama file = "Tingkat-KodeJurusan-Rombel.pdf"
    public function classes(Request $request): JsonResponse
    {
        $request->validate(['files' => ['required', 'array', 'min:1']]);

        $classes = SchoolClass::whereHas('academicYear', fn ($q) => $q->where('aktif', true))->get();

        $berhasil = [];
        $gagal    = [];

        foreach ($request->file('files', []) as $file) {
            $filename = $file->getClientOriginalName();

            if ($err = $this->validateFile($file)) {
                $gagal[] = ['file' => $filename, 'alasan' => $err];
                continue;
            }

            $base  = pathinfo($filename, PATHINFO_FILENAME);
            $parts = preg_split('/[-_\s]+/', trim($base));

            if (count($parts) < 2) {
                $gagal[] = ['file' => $filename, 'alasan' => 'Nama file harus format "Tingkat-KodeJurusan-Rombel.pdf" (mis. "XII-RPL-A.pdf").'];
                continue;
            }

            $tingkat     = mb_strtoupper($parts[0]);
            $rombel      = mb_strtoupper(end($parts));
            $jurusanTok  = mb_strtoupper(implode('', array_slice($parts, 1, -1)));

            if (! in_array($tingkat, ['X', 'XI', 'XII'], true)) {
                $gagal[] = ['file' => $filename, 'alasan' => "Tingkat \"{$tingkat}\" tidak dikenali (harus X/XI/XII)."];
                continue;
            }

            $candidates = $classes->filter(fn ($c) => $c->tingkat->value === $tingkat && mb_strtoupper($c->rombel) === $rombel);

            $match = $this->matchClass($candidates, $jurusanTok);

            if (! $match) {
                $reason = $candidates->isEmpty()
                    ? "Tidak ada kelas {$tingkat} rombel {$rombel} di tahun ajaran aktif."
                    : "Tidak bisa menentukan jurusan \"{$jurusanTok}\" untuk kelas {$tingkat} {$rombel} — cek kolom \"Inisial Kelas\" di Program Keahlian, atau sesuaikan nama file.";
                $gagal[] = ['file' => $filename, 'alasan' => $reason];
                continue;
            }

            if ($match->jadwal_pdf && Storage::disk('public')->exists($match->jadwal_pdf)) {
                Storage::disk('public')->delete($match->jadwal_pdf);
            }
            $path = $file->store('jadwal_kelas', 'public');
            $match->update(['jadwal_pdf' => $path]);

            $berhasil[] = ['file' => $filename, 'kelas' => "{$match->tingkat->value} {$match->jurusan} {$match->rombel}"];
        }

        return response()->json($this->buildResponse('kelas', $berhasil, $gagal));
    }

    /**
     * @param \Illuminate\Support\Collection<int, SchoolClass> $candidates kelas dengan
     *   tingkat+rombel yang sudah cocok — tinggal tentukan jurusan mana lewat token nama file.
     */
    private function matchClass($candidates, string $jurusanTok): ?SchoolClass
    {
        if ($candidates->isEmpty()) return null;
        if ($candidates->count() === 1 && $jurusanTok === '') return $candidates->first();

        // Prioritas 1: cocok persis dengan "Inisial Kelas" (kolom kode di program_keahlians).
        $byKode = $candidates->first(fn ($c) => $c->programKeahlianKode() && mb_strtoupper($c->programKeahlianKode()) === $jurusanTok);
        if ($byKode) return $byKode;

        // Prioritas 2: cocok persis dengan nama jurusan penuh (tanpa spasi).
        $byJurusan = $candidates->first(fn ($c) => mb_strtoupper(preg_replace('/\s+/', '', $c->jurusan)) === $jurusanTok);
        if ($byJurusan) return $byJurusan;

        return null;
    }

    private function validateFile(UploadedFile $file): ?string
    {
        if (! $file->isValid()) {
            return 'File rusak / gagal diunggah.';
        }

        $ext = mb_strtolower($file->getClientOriginalExtension());
        if ($ext !== 'pdf') {
            return 'Format tidak didukung (harus PDF).';
        }

        if ($file->getSize() > self::MAX_KB * 1024) {
            return 'Ukuran melebihi '.self::MAX_KB.'KB.';
        }

        return null;
    }

    private function buildResponse(string $label, array $berhasil, array $gagal): array
    {
        return [
            'message' => "Proses upload jadwal {$label} selesai.",
            'summary' => [
                'total'    => count($berhasil) + count($gagal),
                'berhasil' => count($berhasil),
                'gagal'    => count($gagal),
            ],
            'berhasil' => $berhasil,
            'gagal'    => $gagal,
        ];
    }
}
