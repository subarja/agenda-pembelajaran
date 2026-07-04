<?php

namespace App\Providers;

use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Pencarian case-insensitive yang portable di MySQL maupun PostgreSQL
        // (ILIKE hanya ada di Postgres, kolasi MySQL tidak selalu case-insensitive).
        QueryBuilder::macro('whereLike', function (string $column, ?string $value, string $boolean = 'and') {
            /** @var QueryBuilder $this */
            return $this->whereRaw('LOWER('.$column.') LIKE ?', ['%'.mb_strtolower(trim((string) $value)).'%'], $boolean);
        });

        QueryBuilder::macro('orWhereLike', function (string $column, ?string $value) {
            /** @var QueryBuilder $this */
            return $this->whereLike($column, $value, 'or');
        });
    }
}
