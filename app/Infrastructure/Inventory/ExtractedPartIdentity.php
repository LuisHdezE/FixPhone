<?php
namespace App\Infrastructure\Inventory;

final class ExtractedPartIdentity
{
    public static function key(string $brand, string $model, string $type, string $condition, ?string $owner, string $currency): string
    {
        return hash('sha256', json_encode([$brand, $model, $type, $condition, $owner, $currency], JSON_THROW_ON_ERROR));
    }
}
