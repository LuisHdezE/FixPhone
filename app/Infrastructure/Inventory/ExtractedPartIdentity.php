<?php
namespace App\Infrastructure\Inventory;

final class ExtractedPartIdentity
{
    public static function variant(string $value): string
    {
        return mb_strtolower(trim(preg_replace('/\\s+/u', ' ', $value)));
    }

    public static function key(string $brand, string $model, string $type, string $condition, ?string $owner, string $currency, string $variant = ''): string
    {
        return hash('sha256', json_encode([$brand, $model, $type, $condition, $owner, $currency, self::variant($variant)], JSON_THROW_ON_ERROR));
    }
}
