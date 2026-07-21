#!/usr/bin/env bash
#
# deploy.sh — Deploy backend Laravel dengan AMAN untuk data produksi (cPanel/MySQL).
#
# Prinsip keamanan (baca sebelum pakai):
#   1. SELALU backup database dulu (mysqldump) sebelum menyentuh skema. Kalau backup
#      gagal, deploy DIBATALKAN — tidak ada migrasi tanpa jaring pengaman.
#   2. HANYA `migrate --force` (aditif). Skrip ini TIDAK PERNAH menjalankan
#      migrate:fresh / migrate:refresh / migrate:reset / db:wipe / key:generate —
#      itulah perintah yang MENGHAPUS data / merusak enkripsi. Jangan pernah tambahkan.
#   3. TIDAK menyentuh .env dan TIDAK regenerate APP_KEY (APP_KEY berubah = semua data
#      terenkripsi seperti kredensial R2/SMTP jadi tak terbaca).
#   4. Aman dijalankan berulang, baik ADA migrasi baru maupun TIDAK (kalau tak ada
#      yang pending, `migrate` cuma no-op).
#
# Pemakaian (jalankan dari folder root Laravel, mis. ~/api.agenda/ di cPanel):
#   bash deploy.sh --check      # CEK saja: tampilkan migrasi pending, TIDAK mengubah apa pun
#   bash deploy.sh              # Deploy interaktif (minta konfirmasi sebelum migrate)
#   bash deploy.sh -y           # Deploy tanpa tanya (untuk cron/otomasi)
#
# Variabel yang bisa di-override (opsional), mis:
#   PHP_BIN=/usr/local/bin/ea-php84 bash deploy.sh
#   FRONTEND_DOCROOT=~/public_html bash deploy.sh    # ikut ekstrak dist.zip frontend
#
set -euo pipefail

# ── Konfigurasi (override lewat environment bila perlu) ──────────────────────
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # folder root Laravel = lokasi skrip
PHP_BIN="${PHP_BIN:-php}"
ARTISAN="$PHP_BIN $APP_DIR/artisan"
ENV_FILE="$APP_DIR/.env"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/storage/db-backups}"
BACKUP_KEEP="${BACKUP_KEEP:-20}"                          # simpan 20 backup terakhir
FRONTEND_DIST="${FRONTEND_DIST:-$APP_DIR/../frontend/dist.zip}"
FRONTEND_DOCROOT="${FRONTEND_DOCROOT:-}"                  # kosong = lewati langkah frontend

# ── Flag ─────────────────────────────────────────────────────────────────────
CHECK_ONLY=0; ASSUME_YES=0; SKIP_BACKUP=0
for arg in "$@"; do
  case "$arg" in
    --check|--dry-run) CHECK_ONLY=1 ;;
    -y|--yes)          ASSUME_YES=1 ;;
    --skip-backup)     SKIP_BACKUP=1 ;;
    -h|--help)         grep -E '^#( |$)' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Argumen tak dikenal: $arg (pakai --help)"; exit 2 ;;
  esac
done

c_red()  { printf '\033[0;31m%s\033[0m\n' "$*"; }
c_grn()  { printf '\033[0;32m%s\033[0m\n' "$*"; }
c_ylw()  { printf '\033[0;33m%s\033[0m\n' "$*"; }
c_bold() { printf '\033[1m%s\033[0m\n' "$*"; }
die()    { c_red "✗ $*"; exit 1; }

# Ambil nilai dari .env (quote dikupas). Tidak meng-eval isi .env (aman).
env_get() {
  local line val
  line=$(grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" 2>/dev/null | tail -1) || true
  [ -z "$line" ] && return 0
  val="${line#*=}"
  val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
  printf '%s' "$val"
}

# ── Pastikan aplikasi selalu keluar dari maintenance walau skrip gagal ───────
WENT_DOWN=0
cleanup() {
  if [ "$WENT_DOWN" = "1" ]; then
    c_ylw "↻ Mengembalikan aplikasi dari maintenance (php artisan up)…"
    $ARTISAN up || true
  fi
}
trap cleanup EXIT

# ── 0. Preflight ─────────────────────────────────────────────────────────────
c_bold "══ Deploy Agenda Pembelajaran ══"
echo "Folder aplikasi : $APP_DIR"
command -v "$PHP_BIN" >/dev/null 2>&1 || die "PHP tidak ditemukan ('$PHP_BIN'). Set PHP_BIN=/path/ke/php."
[ -f "$APP_DIR/artisan" ] || die "Bukan folder Laravel (artisan tidak ada di $APP_DIR)."
[ -f "$ENV_FILE" ] || die ".env tidak ada di server — JANGAN buat baru saat deploy (APP_KEY & DB bisa salah)."

DB_CONNECTION="$(env_get DB_CONNECTION)"; DB_CONNECTION="${DB_CONNECTION:-mysql}"
APP_KEY_NOW="$(env_get APP_KEY)"
[ -n "$APP_KEY_NOW" ] || die "APP_KEY di .env KOSONG. Isi dulu (JANGAN key:generate di prod berjalan) sebelum deploy."
echo "Koneksi DB      : $DB_CONNECTION"
echo "PHP             : $($PHP_BIN -r 'echo PHP_VERSION;')"

# ── 1. Tampilkan migrasi yang PENDING (selalu, sebagai laporan) ──────────────
c_bold $'\n── Status migrasi ──'
$ARTISAN migrate:status || die "Gagal membaca status migrasi (cek koneksi DB di .env)."

# Hitung jumlah pending secara aman (kolom 'Ran?' bernilai 'Pending' / 'No')
PENDING=$($ARTISAN migrate:status 2>/dev/null | grep -Eic 'pending|\| *no *\|' || true)
if [ "${PENDING:-0}" -gt 0 ]; then
  c_ylw "→ Ada perubahan skema database (migrasi pending). Backup akan diambil sebelum menerapkannya."
else
  c_grn "→ Tidak ada migrasi pending. Deploy tetap aman (migrate akan jadi no-op)."
fi

if [ "$CHECK_ONLY" = "1" ]; then
  c_bold $'\n✓ Mode --check: tidak ada yang diubah. (kode/DB tidak disentuh)'
  exit 0
fi

# ── 2. Konfirmasi ────────────────────────────────────────────────────────────
if [ "$ASSUME_YES" != "1" ]; then
  echo
  read -r -p "Lanjut deploy (backup DB → migrate --force → clear cache)? ketik 'ya': " ans
  [ "$ans" = "ya" ] || { c_ylw "Dibatalkan."; exit 0; }
fi

# ── 3. Backup database (jaring pengaman — WAJIB sukses) ──────────────────────
if [ "$SKIP_BACKUP" = "1" ]; then
  c_ylw "⚠ --skip-backup dipakai: migrasi TANPA backup. Tidak disarankan."
elif [ "$DB_CONNECTION" = "mysql" ] || [ "$DB_CONNECTION" = "mariadb" ]; then
  command -v mysqldump >/dev/null 2>&1 || die "mysqldump tidak ada — tak bisa backup. Batalkan (pakai --skip-backup hanya bila Anda backup manual via cPanel)."
  mkdir -p "$BACKUP_DIR"
  DB_DATABASE="$(env_get DB_DATABASE)"
  DB_USERNAME="$(env_get DB_USERNAME)"
  DB_HOST="$(env_get DB_HOST)"; DB_HOST="${DB_HOST:-127.0.0.1}"
  DB_PORT="$(env_get DB_PORT)"; DB_PORT="${DB_PORT:-3306}"
  STAMP="$(date +%Y%m%d-%H%M%S)"
  BACKUP_FILE="$BACKUP_DIR/${DB_DATABASE}_${STAMP}.sql.gz"
  c_bold $'\n── Backup database ──'
  echo "→ $BACKUP_FILE"
  # MYSQL_PWD menghindari password tampil di daftar proses. --no-tablespaces:
  # hosting cPanel biasa tanpa privilege PROCESS.
  MYSQL_PWD="$(env_get DB_PASSWORD)" \
    mysqldump --single-transaction --quick --routines --triggers --no-tablespaces \
      -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" "$DB_DATABASE" \
    | gzip > "$BACKUP_FILE" \
    || die "Backup GAGAL — deploy dibatalkan (data tidak disentuh)."
  # Validasi backup tidak kosong
  [ -s "$BACKUP_FILE" ] || die "File backup kosong — deploy dibatalkan."
  c_grn "✓ Backup OK ($(du -h "$BACKUP_FILE" | cut -f1))"
  # Prune backup lama (simpan BACKUP_KEEP terbaru)
  ls -1t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +$((BACKUP_KEEP + 1)) | xargs -r rm -f || true
else
  c_ylw "⚠ DB_CONNECTION=$DB_CONNECTION (bukan mysql). Lewati mysqldump — backup manual bila perlu."
fi

# ── 4. Maintenance mode ──────────────────────────────────────────────────────
c_bold $'\n── Maintenance mode ──'
$ARTISAN down --retry=15 || true
WENT_DOWN=1

# ── 5. Migrasi (ADITIF, tidak merusak data) ──────────────────────────────────
c_bold $'\n── Menerapkan migrasi (migrate --force) ──'
$ARTISAN migrate --force || die "Migrasi GAGAL. App tetap maintenance. Pulihkan DB dari backup bila skema rusak:
    gunzip < \"$BACKUP_FILE\" | mysql -u <user> -p <database>"
c_grn "✓ Migrasi selesai."

# ── 6. Bersihkan cache (aman; tidak nge-cache config agar .env selalu terbaca) ─
c_bold $'\n── Bersihkan cache ──'
$ARTISAN optimize:clear || true
# storage:link idempoten; abaikan bila symlink sudah ada / dibatasi host
$ARTISAN storage:link 2>/dev/null || true

# ── 7. (Opsional) Ekstrak frontend dist.zip ke docroot ───────────────────────
if [ -n "$FRONTEND_DOCROOT" ]; then
  c_bold $'\n── Frontend ──'
  [ -f "$FRONTEND_DIST" ] || die "dist.zip tidak ada di $FRONTEND_DIST"
  command -v unzip >/dev/null 2>&1 || die "unzip tidak ada di server."
  TMP="$(mktemp -d)"
  unzip -q -o "$FRONTEND_DIST" -d "$TMP"
  # dist.zip berisi folder dist/ — salin ISINYA ke docroot (termasuk .htaccess)
  cp -a "$TMP"/dist/. "$FRONTEND_DOCROOT"/
  rm -rf "$TMP"
  c_grn "✓ Frontend disalin ke $FRONTEND_DOCROOT"
fi

# ── 8. Selesai — keluar dari maintenance ─────────────────────────────────────
$ARTISAN up || true
WENT_DOWN=0
c_bold $'\n══════════════════════════════'
c_grn "✓ DEPLOY SELESAI dengan aman. Data lama tidak disentuh (hanya migrasi aditif)."
[ "${BACKUP_FILE:-}" ] && echo "  Backup: $BACKUP_FILE"
