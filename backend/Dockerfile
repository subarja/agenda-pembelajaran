# ── Base ──────────────────────────────────────────────────────────────────────
FROM php:8.4-cli-alpine AS base

RUN apk add --no-cache \
        libpq-dev \
        libzip-dev \
        libxml2-dev \
        oniguruma-dev \
        icu-dev \
        postgresql16-client \
        libpng-dev \
        libjpeg-turbo-dev \
        freetype-dev \
        $PHPIZE_DEPS \
    && docker-php-ext-configure gd --with-jpeg --with-freetype \
    && docker-php-ext-install \
        pdo_pgsql \
        pgsql \
        bcmath \
        mbstring \
        xml \
        zip \
        pcntl \
        intl \
        gd \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del $PHPIZE_DEPS \
    && rm -rf /var/cache/apk/*

# Default php:8.4-cli-alpine sangat ketat utk upload masal (max_file_uploads=20,
# post_max_size=8M) — cukup bikin bulk-upload foto siswa/guru gagal diam-diam.
COPY docker/php/uploads.ini /usr/local/etc/php/conf.d/uploads.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# ── Development ───────────────────────────────────────────────────────────────
FROM base AS development

ENV APP_ENV=local \
    APP_DEBUG=true

COPY . .

RUN composer install --no-interaction --prefer-dist \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 8000
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]

# ── Production ────────────────────────────────────────────────────────────────
FROM base AS production

ENV APP_ENV=production \
    APP_DEBUG=false

COPY . .

RUN composer install --no-interaction --prefer-dist --no-dev --optimize-autoloader \
    && php artisan config:cache \
    && php artisan route:cache \
    && php artisan view:cache \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 8000
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
