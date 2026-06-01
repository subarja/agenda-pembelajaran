<?php

namespace App\Enums;

enum AgendaStatus: string
{
    case Draft     = 'draft';
    case Submitted = 'submitted';
}
