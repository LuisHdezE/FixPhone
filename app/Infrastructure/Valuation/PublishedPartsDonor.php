<?php

namespace App\Infrastructure\Valuation;

use Illuminate\Database\Eloquent\Builder;

/** Central public gate. Never return raw Valuation or Inventory Eloquent models in a storefront response. */
final class PublishedPartsDonor
{
    public static function query(): Builder
    {
        return DeviceValuation::query()->with('verifiedPhotos')
            ->where('public_listing_status', 'published')
            ->where('provenance_confirmed', true)
            ->whereNotNull('public_image_url')
            ->whereNotNull('public_description')
            ->where('asking_price_minor', '>', 0)
            ->whereHas('inventoryItem', static function (Builder $query): void {
                $query->whereIn('item_type', ['device', 'used_phone'])
                    ->where('inventory_purpose', 'parts_donor')
                    ->where('stock_quantity', '>', 0);
            });
    }

    public static function publicData(DeviceValuation $valuation): array
    {
        // Whitelist intentionally excludes private notes, appraisal margins, client data,
        // purchase costs, inventory metadata, IMEI and Facebook account details.
        $verified = $valuation->verifiedPhotos->pluck('public_url')->all();
        $images = array_values(array_unique(array_merge(
            [$valuation->public_image_url], $verified,
        )));
        return [
            'id' => $valuation->id,
            'model_name' => $valuation->model_name,
            'title' => $valuation->model_name.' · Para repuestos',
            'category' => 'phones_for_parts',
            'fault_type' => $valuation->fault_type,
            'fault_label' => match ($valuation->fault_type) {
                'icloud' => 'Bloqueo de activación iCloud',
                'no_signal' => 'Sin señal móvil',
                'board' => 'Falla de placa',
                default => 'Equipo con falla',
            },
            'screen_condition' => $valuation->screen_condition,
            'power_state' => $valuation->power_state,
            'price_minor' => $valuation->asking_price_minor,
            'currency_code' => 'UYU',
            'image_url' => $valuation->public_image_url,
            'images' => $images,
            'description' => $valuation->public_description,
            'availability' => 'available',
            'href' => '/store/for-parts/'.$valuation->id,
        ];
    }
}
