<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Inventory\Consignor;
use App\Infrastructure\Inventory\DeviceSaleRecord;
use App\Infrastructure\RepairQuotes\RepairQuote;
use App\Infrastructure\Valuation\DeviceValuation;
use App\Infrastructure\Inventory\DeviceInstalledPart;
use App\Infrastructure\Identity\User;
use Illuminate\Support\Facades\Hash;

echo "Items: " . InventoryItem::count() . "\n";
echo "Consignors: " . Consignor::count() . "\n";
echo "Sales: " . DeviceSaleRecord::count() . "\n";
echo "Quotes: " . RepairQuote::count() . "\n";
echo "Valuations: " . DeviceValuation::count() . "\n";
echo "Parts: " . DeviceInstalledPart::count() . "\n";

$user = User::firstOrCreate(
    ['email' => 'admin@demo.local'],
    [
        'id' => (string) Illuminate\Support\Str::ulid(),
        'name' => 'Demo Admin',
        'password' => Hash::make('fixphone2026')
    ]
);

echo "Admin user created: admin@demo.local / fixphone2026\n";
