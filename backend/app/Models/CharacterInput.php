<?php

namespace App\Models;

use App\Enums\CharacterSign;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CharacterInput extends Model
{
    protected $fillable = [
        'student_id', 'subitem_id', 'teacher_id',
        'agenda_id', 'sign', 'catatan',
    ];

    protected function casts(): array
    {
        return [
            'sign' => CharacterSign::class,
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function subitem(): BelongsTo
    {
        return $this->belongsTo(CharacterSubitem::class, 'subitem_id');
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function agenda(): BelongsTo
    {
        return $this->belongsTo(Agenda::class);
    }
}
