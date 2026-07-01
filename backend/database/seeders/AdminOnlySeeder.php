<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminOnlySeeder extends Seeder
{
    public function run(): void
    {
        User::create([
            'nama'     => 'Administrator',
            'email'    => 'admin@smkn2cimahi.sch.id',
            'password' => Hash::make('password'),
            'role'     => UserRole::Admin,
            'status'   => UserStatus::Aktif,
        ]);
    }
}
