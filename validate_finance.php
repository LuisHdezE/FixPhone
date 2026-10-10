<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Infrastructure\Inventory\DeviceSaleRecord;

$sale = DeviceSaleRecord::where('inventory_purpose', 'sell_as_used_phone')
    ->where('initial_cost_amount_minor', 400000)
    ->where('effective_sale_price_minor', 1000000)
    ->first();

if ($sale) {
    echo "Financial Validation for Demo Device:\n";
    echo "Sale Price (UYU): " . ($sale->effective_sale_price_minor / 100) . "\n";
    echo "Initial Cost (UYU): " . ($sale->initial_cost_amount_minor / 100) . "\n";
    echo "Parts Cost (UYU): " . ($sale->installed_parts_cost_minor / 100) . "\n";
    
    // Liquidación = 50% * (PrecioVenta - CostoInicialEquipo - CostoRepuestosInstalados)
    $liquidacion = ($sale->effective_sale_price_minor - $sale->initial_cost_amount_minor - $sale->installed_parts_cost_minor) * 0.5;
    echo "Calculated Liquidacion (UYU): " . ($liquidacion / 100) . "\n";
} else {
    echo "Device not found!\n";
}
