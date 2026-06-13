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
	@echo "==> [3/6] Menunggu PostgreSQL siap..."
	@until docker compose exec -T db pg_isready -U agenda_user -d agenda_db > /dev/null 2>&1; do \
		printf "."; sleep 2; \
	done
	@echo " ✓ PostgreSQL siap"
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
		&& docker compose restart backend worker \
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
	@echo "  Admin    : admin@smkn2cimahi.sch.id"
	@echo "  Wakasek  : kusman@smkn2cimahi.sch.id"
	@echo "  Guru     : guru@smkn2cimahi.sch.id"
	@echo "  WaliKelas: walikelas@smkn2cimahi.sch.id"
	@echo "  Siswa    : siswa@smkn2cimahi.sch.id"
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

# Ulangi seeder saja (tanpa hapus & buat ulang tabel)
seed:
	docker compose exec backend php artisan db:seed --force

logs:
	docker compose logs -f

.PHONY: setup start restart stop reset seed logs
