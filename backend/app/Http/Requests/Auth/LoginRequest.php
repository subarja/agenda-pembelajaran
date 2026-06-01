<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'identifier'  => ['required', 'string'],   // email / NIP / NISN
            'password'    => ['required', 'string'],
            'device_name' => ['sometimes', 'string', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'identifier.required' => 'Email, NIP, atau NISN wajib diisi.',
            'password.required'   => 'Password wajib diisi.',
        ];
    }
}
