.DEFAULT_GOAL := start

# ── PERTAMA KALI (setup lengkap) ─────────────────────────────────────────────
setup:
	@echo ""
	@echo "╔══════════════════════════════════════════════╗"
	@echo "║     Agenda Pembelajaran — Setup Awal         ║"
	@echo "╚══════════════════════════════════════════════╝"
	@echo ""
	@echo "==> [1/6] Menyiapkan file konfigurasi..."
	@[ -f .env ] || cp .env.example .env
	@cp backend/.env.docker backend/.env
	@echo "    ✓ .env siap"
	@echo ""
	@echo "==> [2/6] Build image dan jalankan semua service..."
	docker compose up --build -d
	@echo ""
	@echo "==> [3/6] Menunggu MySQL siap..."
	@until docker compose exec -T db mysqladmin ping -h localhost -u agenda_user -psecret --silent > /dev/null 2>&1; do \
		printf "."; sleep 2; \
	done
	@echo " ✓ MySQL siap"
	@echo ""
	@echo "==> [4/6] Menunggu backend Laravel siap..."
	@until docker compose exec -T backend php artisan --version > /dev/null 2>&1; do \
		printf "."; sleep 2; \
	done
	@echo " ✓ Backend siap"
	@echo ""
	@echo "==> [5/6] Generate APP_KEY dan restart service..."
	@KEY=$$(docker compose exec -T backend php artisan key:generate --show --no-ansi | tr -d '\r\n') \
		&& sed -i "s|^APP_KEY=.*|APP_KEY=$$KEY|" .env \
		&& sed -i "s|^APP_KEY=.*|APP_KEY=$$KEY|" backend/.env \
		&& docker compose up -d backend worker \
		&& until docker compose exec -T backend php artisan --version > /dev/null 2>&1; do sleep 2; done \
		&& echo "    ✓ APP_KEY diset, backend restart selesai"
	@echo ""
	@echo "==> [6/6] Migrasi database dan isi data awal (seeder)..."
	docker compose exec backend php artisan migrate:fresh --seed --force
	@echo ""
	@echo "╔══════════════════════════════════════════════╗"
	@echo "║  ✓ Setup selesai! Buka: http://localhost:5173 ║"
	@echo "╚══════════════════════════════════════════════╝"
	@echo ""
	@echo "  Akun login (semua password: password)"
	@echo "  ─────────────────────────────────────────────"
	@echo "  Admin      : admin@smkn2cimahi.sch.id"
	@echo "  Wakasek    : kusman@smkn2cimahi.sch.id"
	@echo "  Guru       : guru@smkn2cimahi.sch.id"
	@echo "  Wali Kelas : walikelas@smkn2cimahi.sch.id"
	@echo "  Guru BK    : bk@smkn2cimahi.sch.id"
	@echo "  Orang Tua  : orangtua@smkn2cimahi.sch.id"
	@echo "  Siswa      : siswa@smkn2cimahi.sch.id"
	@echo ""

# ── SEHARI-HARI ───────────────────────────────────────────────────────────────
start:
	docker compose up -d --remove-orphans

restart:
	docker compose restart

stop:
	docker compose down

reset:
	docker compose down -v

# Reset DB — hanya menyisakan akun super admin (admin@smkn2cimahi.sch.id)
reseed:
	docker compose exec backend php artisan migrate:fresh --seeder=AdminOnlySeeder --force
	@echo ""
	@echo "✓ Database dikosongkan. Hanya akun admin@smkn2cimahi.sch.id yang tersisa."
	@echo ""

# Reset DB + seed data demo lengkap
reseed-demo:
	docker compose exec backend php artisan migrate:fresh --seed --force
	@echo ""
	@echo "✓ Database direset dan data demo diisi ulang."
	@echo ""

# Ulangi seeder saja tanpa drop tabel (untuk debugging seeder)
seed:
	docker compose exec backend php artisan db:seed --force

logs:
	docker compose logs -f

.PHONY: setup start restart stop reset reseed reseed-demo seed logs
