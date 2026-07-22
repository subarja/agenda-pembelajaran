<?php

namespace App\Console\Commands;

use App\Support\JadwalPdfMaintenance;
use Illuminate\Console\Command;

class PruneOrphanJadwalPdf extends Command
{
    protected $signature = 'jadwal:prune-orphans {--dry : Tampilkan yang akan dihapus tanpa menghapus}';

    protected $description = 'Hapus berkas PDF jadwal yatim (tidak direferensikan guru/kelas mana pun)';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry');
        $r = JadwalPdfMaintenance::pruneOrphans($dry);

        $this->info(sprintf(
            '%s%d berkas yatim %s, %d dipakai, ~%d KB %s.',
            $dry ? '[DRY] ' : '',
            $r['dihapus'],
            $dry ? 'akan dihapus' : 'dihapus',
            $r['dipakai'],
            $r['freed_kb'],
            $dry ? 'akan dibebaskan' : 'dibebaskan',
        ));

        return self::SUCCESS;
    }
}
