<?php

declare(strict_types=1);

namespace App\Application\CommercialDecision;

/** Read-only operational facts; persistence belongs to an infrastructure adapter. */
interface CommercialInputSnapshot
{
    public function forDevice(string $id): array;
}
