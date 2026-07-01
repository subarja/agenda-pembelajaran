# ── Base ──────────────────────────────────────────────────────────────────────
FROM php:8.4-cli-alpine AS base

RUN apk add --no-cache \
        libpq-dev \
        libzip-dev \
        libxml2-dev \
        oniguruma-dev \
        icu-dev \
        postgresql16-client \
        $PHPIZE_DEPS \
    && docker-php-ext-install \
        pdo_pgsql \
        pgsql \
        bcmath \
        mbstring \
        xml \
        zip \
        pcntl \
        intl \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del $PHPIZE_DEPS \
    && rm -rf /var/cache/apk/*

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
