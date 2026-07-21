#!/usr/bin/env bash
#
# postdeploy-check.sh — Verifikasi PASCA-DEPLOY (read-only, tidak mengubah apa pun).
#
# Memastikan migrasi benar-benar masuk dan aplikasi tidak 500 setelah deploy.
# Semua pemeriksaan hanya MEMBACA — aman dijalankan kapan saja.
#
# Pemakaian (dari folder root Laravel di server):
#   bash postdeploy-check.sh
#
# Cek endpoint HTTP (opsional):
#   BASE_URL=https://api.agenda.smkn2cmi.sch.id bash postdeploy-check.sh
#   # + uji endpoint terproteksi (butuh token guru; lihat cara ambil token di bawah):
#   BASE_URL=https://api.agenda.smkn2cmi.sch.id TOKEN=xxxxx bash postdeploy-check.sh
#
# Override PHP CLI bila perlu:  PHP_BIN=/opt/cpanel/ea-php84/root/usr/bin/php bash postdeploy-check.sh
#
set -uo pipefail   # sengaja TANPA -e: semua cek dijalankan, gagal dikumpulkan

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PHP_BIN="${PHP_BIN:-php}"
ARTISAN="$PHP_BIN $APP_DIR/artisan"
BASE_URL="${BASE_URL:-}"
TOKEN="${TOKEN:-}"

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf '  \033[0;32m✓\033[0m %s\n' "$*"; }
bad()  { FAIL=$((FAIL+1)); printf '  \033[0;31m✗ %s\033[0m\n' "$*"; }
head() { printf '\n\033[1m%s\033[0m\n' "$*"; }

command -v "$PHP_BIN" >/dev/null 2>&1 || { echo "PHP tidak ditemukan ('$PHP_BIN')"; exit 2; }
[ -f "$APP_DIR/artisan" ] || { echo "Bukan folder Laravel ($APP_DIR)"; exit 2; }

# ── 1. Migrasi: tidak boleh ada yang pending ─────────────────────────────────
head "1. Status migrasi"
STATUS="$($ARTISAN migrate:status 2>&1)" || true
PENDING=$(printf '%s' "$STATUS" | grep -Eic 'pending|\| *no *\|' || true)
if [ "${PENDING:-0}" -eq 0 ]; then ok "Semua migrasi sudah diterapkan (0 pending)"
else bad "$PENDING migrasi masih PENDING — jalankan: bash deploy.sh"; fi

# ── 2. Skema kritikal (kolom/tabel dari batch terakhir) ──────────────────────
head "2. Skema database (kolom & tabel yang wajib ada)"
SCHEMA_OUT="$($ARTISAN tinker --execute='
$S = "\Illuminate\Support\Facades\Schema";
$cek = [
  ["tabel bell_periods",                    $S::hasTable("bell_periods")],
  ["tabel teaching_assignments",            $S::hasTable("teaching_assignments")],
  ["tabel branding_settings",               $S::hasTable("branding_settings")],
  ["tabel password_default_settings",       $S::hasTable("password_default_settings")],
  ["tabel archive_write_settings",          $S::hasTable("archive_write_settings")],
  ["kolom students.jenis_kelamin",          $S::hasColumn("students","jenis_kelamin")],
  ["kolom users.must_change_password",      $S::hasColumn("users","must_change_password")],
  ["kolom kokurikuler_projects.selesai_pada", $S::hasColumn("kokurikuler_projects","selesai_pada")],
];
foreach ($cek as [$n,$v]) { echo ($v ? "PASS" : "FAIL")."|".$n."\n"; }
' 2>/dev/null)"
if [ -z "$SCHEMA_OUT" ]; then
  bad "Tidak bisa memeriksa skema (tinker gagal — cek koneksi DB di .env)"
else
  while IFS='|' read -r res name; do
    [ -z "${name:-}" ] && continue
    [ "$res" = "PASS" ] && ok "$name" || bad "$name  (migrasi belum jalan?)"
  done <<< "$(printf '%s' "$SCHEMA_OUT" | grep -E '^(PASS|FAIL)\|')"
fi

# ── 3. Konfigurasi inti ──────────────────────────────────────────────────────
head "3. Konfigurasi inti"
APP_ENV="$($ARTISAN tinker --execute='echo config("app.env");' 2>/dev/null | tail -1)"
APP_KEY_SET="$($ARTISAN tinker --execute='echo config("app.key") ? "yes" : "no";' 2>/dev/null | tail -1)"
[ "$APP_KEY_SET" = "yes" ] && ok "APP_KEY terpasang" || bad "APP_KEY KOSONG — data terenkripsi tak terbaca!"
[ "$APP_ENV" = "production" ] && ok "APP_ENV=production" || bad "APP_ENV=$APP_ENV (harusnya production di server)"

# DB reachable
DB_OK="$($ARTISAN tinker --execute='try { \Illuminate\Support\Facades\DB::select("select 1"); echo "ok"; } catch (\Throwable $e) { echo "ERR:".$e->getMessage(); }' 2>/dev/null | tail -1)"
[ "$DB_OK" = "ok" ] && ok "Database terhubung" || bad "Database TIDAK terhubung: $DB_OK"

# ── 4. Status aplikasi (maintenance & storage link) ──────────────────────────
head "4. Status aplikasi"
if [ -f "$APP_DIR/storage/framework/down" ]; then bad "Aplikasi masih MAINTENANCE — jalankan: php artisan up"
else ok "Aplikasi hidup (bukan maintenance)"; fi
if [ -e "$APP_DIR/public/storage" ]; then ok "Symlink storage ada (foto/dokumen bisa diakses)"
else bad "public/storage hilang — jalankan: php artisan storage:link"; fi

# ── 5. Endpoint HTTP (opsional, butuh BASE_URL) ──────────────────────────────
if [ -n "$BASE_URL" ]; then
  head "5. Endpoint HTTP ($BASE_URL)"
  # Liveness: rute terproteksi tanpa token harus 401, BUKAN 5xx (5xx = app rusak)
  code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Accept: application/json' "$BASE_URL/api/v1/user" || echo 000)
  case "$code" in
    401) ok "API hidup (/user tanpa token → 401 seperti seharusnya)";;
    5*)  bad "/user → HTTP $code (aplikasi error 5xx)";;
    000) bad "Tidak bisa menjangkau $BASE_URL (jaringan/domain?)";;
    *)   ok "/user → HTTP $code (bukan 5xx)";;
  esac

  if [ -n "$TOKEN" ]; then
    for ep in "agendas/perlu-diisi" "schedules/today"; do
      code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' "$BASE_URL/api/v1/$ep" || echo 000)
      case "$code" in
        2*) ok "/$ep → HTTP $code (guru bisa mengisi agenda — kokurikuler/selesai_pada OK)";;
        5*) bad "/$ep → HTTP $code — kemungkinan kolom belum di-migrate (mis. selesai_pada)";;
        *)  bad "/$ep → HTTP $code (token kadaluarsa? cek manual)";;
      esac
    done
  else
    printf '  \033[0;33m(lewati uji terproteksi: set TOKEN=... untuk menguji /agendas/perlu-diisi)\033[0m\n'
  fi
else
  head "5. Endpoint HTTP"
  printf '  \033[0;33m(lewati: set BASE_URL=https://api.agenda... untuk menguji endpoint)\033[0m\n'
fi

# ── Ringkasan ────────────────────────────────────────────────────────────────
printf '\n\033[1m══ Ringkasan: %d lolos, %d gagal ══\033[0m\n' "$PASS" "$FAIL"
if [ "$FAIL" -eq 0 ]; then
  printf '\033[0;32m✓ Deploy sehat. Uji manual terakhir: login → isi agenda → buka menu kokurikuler.\033[0m\n'
  exit 0
else
  printf '\033[0;31m✗ Ada %d masalah di atas — perbaiki sebelum dianggap selesai.\033[0m\n' "$FAIL"
  exit 1
fi
