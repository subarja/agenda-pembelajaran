<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Step 1: Tambah kolom baru ────────────────────────────────────────
        Schema::table('learning_objectives', function (Blueprint $table) {
            $table->string('fase', 1)->nullable()->after('subject_id');    // 'E' or 'F'
            $table->unsignedBigInteger('academic_year_id')->nullable()->after('fase');
            $table->foreign('academic_year_id')->references('id')->on('academic_years')->restrictOnDelete();
        });

        // ── Step 2: Isi fase dari tingkat kelas ──────────────────────────────
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement("
                UPDATE learning_objectives
                SET fase = CASE WHEN c.tingkat = 'X' THEN 'E' ELSE 'F' END
                FROM classes c
                WHERE c.id = learning_objectives.class_id
            ");
        } else {
            DB::statement("
                UPDATE learning_objectives
                JOIN classes c ON c.id = learning_objectives.class_id
                SET learning_objectives.fase = CASE WHEN c.tingkat = 'X' THEN 'E' ELSE 'F' END
            ");
        }

        // ── Step 3: Isi academic_year_id dari tahun ajaran aktif ─────────────
        $activeYear = DB::table('academic_years')->where('aktif', true)->first();
        $fallbackYear = $activeYear ?? DB::table('academic_years')->orderBy('id')->first();

        if ($fallbackYear) {
            DB::table('learning_objectives')
                ->whereNull('academic_year_id')
                ->update(['academic_year_id' => $fallbackYear->id]);
        }

        // ── Step 4: Deduplikasi — per (subject_id, fase, semester, kode, academic_year_id)
        //            simpan yang updated_at paling baru ─────────────────────────
        $groups = DB::table('learning_objectives')
            ->select('subject_id', 'fase', 'semester', 'kode', 'academic_year_id')
            ->whereNull('deleted_at')
            ->whereNotNull('fase')
            ->whereNotNull('academic_year_id')
            ->groupBy('subject_id', 'fase', 'semester', 'kode', 'academic_year_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($groups as $g) {
            $dupes = DB::table('learning_objectives')
                ->where('subject_id', $g->subject_id)
                ->where('fase', $g->fase)
                ->where('semester', $g->semester)
                ->where('kode', $g->kode)
                ->where('academic_year_id', $g->academic_year_id)
                ->whereNull('deleted_at')
                ->orderByDesc('updated_at')
                ->get();

            $survivor = $dupes->first();
            $toDelete = $dupes->slice(1)->pluck('id')->toArray();
            if (empty($toDelete)) continue;

            // Redirect pivot: hati-hati jika (agenda_id, survivor_id) sudah ada
            $pivotRows = DB::table('agenda_learning_objectives')
                ->whereIn('learning_objective_id', $toDelete)
                ->get();

            foreach ($pivotRows as $pivot) {
                $alreadyExists = DB::table('agenda_learning_objectives')
                    ->where('agenda_id', $pivot->agenda_id)
                    ->where('learning_objective_id', $survivor->id)
                    ->exists();

                if ($alreadyExists) {
                    DB::table('agenda_learning_objectives')
                        ->where('agenda_id', $pivot->agenda_id)
                        ->where('learning_objective_id', $pivot->learning_objective_id)
                        ->delete();
                } else {
                    DB::table('agenda_learning_objectives')
                        ->where('agenda_id', $pivot->agenda_id)
                        ->where('learning_objective_id', $pivot->learning_objective_id)
                        ->update(['learning_objective_id' => $survivor->id]);
                }
            }

            DB::table('learning_objectives')
                ->whereIn('id', $toDelete)
                ->update(['deleted_at' => now()]);
        }

        // ── Step 5: Drop unique index lama (sebelum drop kolom yang dirujuknya) ─
        Schema::table('learning_objectives', function (Blueprint $table) {
            $table->dropIndex(['teacher_id', 'subject_id']); // index sekunder
            $table->dropUnique('lo_class_subject_kode_unique');
        });

        // ── Step 6: Drop foreign key + kolom lama ────────────────────────────
        Schema::table('learning_objectives', function (Blueprint $table) {
            $table->dropForeign(['teacher_id']);
            $table->dropForeign(['class_id']);
            $table->dropColumn(['teacher_id', 'class_id']);
        });

        // ── Step 7: NOT NULL + partial unique index (WHERE deleted_at IS NULL)
        //           Partial index agar soft-deleted record tidak trigger violation ──
        Schema::table('learning_objectives', function (Blueprint $table) {
            $table->string('fase', 1)->nullable(false)->change();
            $table->unsignedBigInteger('academic_year_id')->nullable(false)->change();
        });

        // Partial unique index — hanya baris aktif (non-soft-deleted) yang dijamin unik
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('
                CREATE UNIQUE INDEX lo_subject_fase_kode_unique
                ON learning_objectives (subject_id, fase, semester, academic_year_id, kode)
                WHERE deleted_at IS NULL
            ');
        } else {
            // MySQL/MariaDB tidak punya partial/filtered unique index seperti Postgres.
            // Emulasi: kolom generated yang bernilai 0 utk semua baris aktif (jadi ikut
            // diperiksa unique bareng), tapi unik per baris (pakai id sendiri) utk baris
            // yang sudah soft-deleted (supaya tidak ikut kena constraint).
            DB::statement('
                ALTER TABLE learning_objectives
                ADD COLUMN deleted_at_marker BIGINT UNSIGNED
                    GENERATED ALWAYS AS (IF(deleted_at IS NULL, 0, id)) STORED
            ');
            DB::statement('
                CREATE UNIQUE INDEX lo_subject_fase_kode_unique
                ON learning_objectives (subject_id, fase, semester, academic_year_id, kode, deleted_at_marker)
            ');
        }
    }

    public function down(): void
    {
        throw new \RuntimeException('Migration tidak bisa di-rollback secara otomatis. Restore dari backup database.');
    }
};
