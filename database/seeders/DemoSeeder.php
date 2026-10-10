<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Inventory\Consignor;
use App\Infrastructure\Inventory\DeviceSaleRecord;
use App\Infrastructure\Inventory\DeviceInstalledPart;
use App\Infrastructure\Inventory\DeviceCodeAllocator;
use Carbon\Carbon;

class DemoSeeder extends Seeder
{
    public function run()
    {
        if (app()->environment('production')) {
            $this->command->error('No se pueden ejecutar seeders de demostración en producción.');
            return;
        }

        $this->command->info('Generando entorno de demostración con más de 200 registros...');

        DB::transaction(function () {
            // 1. Limpiar datos de demostración si los hubiera (opcional si es db:seed --fresh)
            // Para simplicidad, agregamos nuevos.

            // 2. Crear 30 consignantes ficticios
            $consignors = [];
            for ($i = 0; $i < 30; $i++) {
                $consignors[] = Consignor::create([
                    'id' => (string) Str::ulid(),
                    'full_name' => 'Consignante ' . $i . ' ' . Str::random(5),
                    'document_number' => '1234567' . $i,
                    'phone' => '099000' . sprintf('%03d', $i),
                    'email' => 'consignante' . $i . '@demo.com',
                ]);
            }

            // --- CASO FINANCIERO OBLIGATORIO ---
            // Venta: 10.000 UYU, Costo inicial: 4.000 UYU, Repuestos: 1.000 UYU, Liquidación: 2.500 UYU
            $deviceRequired = InventoryItem::create([
                'id' => (string) Str::ulid(),
                'sku' => DeviceCodeAllocator::reserve(),
                'title' => 'iPhone 11 (Demostración Financiera A)',
                'item_type' => 'used_phone',
                'brand' => 'Apple',
                'model' => 'iPhone 11',
                'inventory_purpose' => 'sell_as_used_phone',
                'operational_status' => 'sold',
                'publication_status' => 'draft',
                'dismantling_status' => 'not_started',
                'is_sellable' => false,
                'stock_quantity' => 0,
                'cost_amount_minor' => 400000,
                'sale_price_amount_minor' => 1000000,
                'currency_code' => 'UYU',
            ]);
            
            DeviceInstalledPart::create([
                'id' => (string) Str::ulid(),
                'inventory_item_id' => $deviceRequired->id,
                'part_name' => 'Batería Original',
                'cost_amount_minor' => 100000,
                'currency_code' => 'UYU',
                'installed_at' => Carbon::now()->subDays(6),
                'installed_by_actor_id' => 'admin_demo',
            ]);

            DeviceSaleRecord::create([
                'id' => (string) Str::ulid(),
                'inventory_item_id' => $deviceRequired->id,
                'request_id' => (string) Str::uuid(),
                'effective_sale_price_minor' => 1000000,
                'initial_cost_amount_minor' => 400000,
                'installed_parts_cost_minor' => 100000,
                'currency_code' => 'UYU',
                'inventory_purpose' => 'sell_as_used_phone',
                'sold_at' => Carbon::now()->subDays(5),
                'sold_by_actor_id' => 'admin_demo',
                'status' => 'completed',
            ]);

            // 3. Generar 80 teléfonos propios (Direct Sales)
            $models = ['Samsung Galaxy S20', 'iPhone 12', 'Xiaomi Redmi Note 10'];
            for ($i = 0; $i < 80; $i++) {
                $isSold = ($i % 3) !== 0; // 66% vendidos
                $device = InventoryItem::create([
                    'id' => (string) Str::ulid(),
                    'sku' => DeviceCodeAllocator::reserve(),
                    'title' => $models[$i % 3] . ' ' . $i,
                    'item_type' => 'used_phone',
                    'brand' => 'Brand',
                    'model' => 'Model',
                    'inventory_purpose' => 'sell_as_used_phone',
                    'operational_status' => $isSold ? 'sold' : 'en_stock',
                    'publication_status' => $isSold ? 'draft' : 'publicado',
                    'dismantling_status' => 'not_started',
                    'is_sellable' => !$isSold,
                    'stock_quantity' => $isSold ? 0 : 1,
                    'cost_amount_minor' => (1000 + ($i * 10)) * 100,
                    'sale_price_amount_minor' => (6000 + ($i * 50)) * 100,
                    'currency_code' => 'UYU',
                ]);

                // Algunos tienen repuestos
                if ($i % 2 === 0) {
                    $partsCost = (500 + ($i * 10)) * 100;
                    DeviceInstalledPart::create([
                        'id' => (string) Str::ulid(),
                        'inventory_item_id' => $device->id,
                        'part_name' => 'Repuesto Generico',
                        'cost_amount_minor' => $partsCost,
                        'currency_code' => 'UYU',
                        'installed_at' => Carbon::now()->subDays(($i % 20) + 1),
                        'installed_by_actor_id' => 'admin_demo',
                    ]);
                }

                if ($isSold) {
                    $partsCost = DeviceInstalledPart::where('inventory_item_id', $device->id)->sum('cost_amount_minor');
                    DeviceSaleRecord::create([
                        'id' => (string) Str::ulid(),
                        'inventory_item_id' => $device->id,
                        'request_id' => (string) Str::uuid(),
                        'effective_sale_price_minor' => $device->sale_price_amount_minor,
                        'initial_cost_amount_minor' => $device->cost_amount_minor,
                        'installed_parts_cost_minor' => $partsCost,
                        'currency_code' => 'UYU',
                        'inventory_purpose' => 'sell_as_used_phone',
                        'sold_at' => Carbon::now()->subDays(($i % 20) + 1),
                        'sold_by_actor_id' => 'admin_demo',
                        'status' => 'completed',
                    ]);
                }
            }

            // 4. Generar 60 teléfonos consignados
            for ($i = 0; $i < 60; $i++) {
                $consignor = $consignors[$i % 30];
                $isSold = ($i % 2) === 0;
                $device = InventoryItem::create([
                    'id' => (string) Str::ulid(),
                    'sku' => DeviceCodeAllocator::reserve(),
                    'title' => 'Consignado ' . $i,
                    'item_type' => 'used_phone',
                    'inventory_purpose' => 'consigned_phone',
                    'consignor_id' => $consignor->id,
                    'operational_status' => $isSold ? 'sold' : 'en_stock',
                    'publication_status' => 'draft',
                    'dismantling_status' => 'not_started',
                    'is_sellable' => !$isSold,
                    'stock_quantity' => $isSold ? 0 : 1,
                    'cost_amount_minor' => 0,
                    'sale_price_amount_minor' => (5000 + ($i * 100)) * 100,
                    'currency_code' => 'UYU',
                ]);

                if ($isSold) {
                    DeviceSaleRecord::create([
                        'id' => (string) Str::ulid(),
                        'inventory_item_id' => $device->id,
                        'request_id' => (string) Str::uuid(),
                        'effective_sale_price_minor' => $device->sale_price_amount_minor,
                        'initial_cost_amount_minor' => 0,
                        'installed_parts_cost_minor' => 0,
                        'currency_code' => 'UYU',
                        'inventory_purpose' => 'consigned_phone',
                        'consignor_id' => $consignor->id,
                        'consignor_name' => $consignor->full_name,
                        'sold_at' => Carbon::now()->subDays(($i % 20) + 1),
                        'sold_by_actor_id' => 'admin_demo',
                        'status' => 'completed',
                    ]);
                }
            }

            // 5. Generar 40 teléfonos para despiece
            $dismantlingStatuses = ['not_started', 'in_progress', 'completed'];
            for ($i = 0; $i < 40; $i++) {
                InventoryItem::create([
                    'id' => (string) Str::ulid(),
                    'sku' => DeviceCodeAllocator::reserve(),
                    'title' => 'Donor ' . $i,
                    'item_type' => 'device',
                    'inventory_purpose' => 'dismantle',
                    'operational_status' => 'para_despiece',
                    'publication_status' => 'draft',
                    'dismantling_status' => $dismantlingStatuses[$i % 3],
                    'is_sellable' => false,
                    'stock_quantity' => 1,
                    'cost_amount_minor' => (500 + ($i * 10)) * 100,
                    'currency_code' => 'UYU',
                ]);
            }
            
            // 6. Generar 20 pendientes de evaluación / repuestos sueltos
            for ($i = 0; $i < 20; $i++) {
                InventoryItem::create([
                    'id' => (string) Str::ulid(),
                    'sku' => DeviceCodeAllocator::reserve(),
                    'title' => 'Repuesto ' . $i,
                    'item_type' => 'spare_part',
                    'inventory_purpose' => 'sell_as_spare_part',
                    'operational_status' => 'en_stock',
                    'publication_status' => 'draft',
                    'is_sellable' => true,
                    'stock_quantity' => 5 + $i,
                    'cost_amount_minor' => (100 + ($i * 10)) * 100,
                    'sale_price_amount_minor' => (500 + ($i * 20)) * 100,
                    'currency_code' => 'UYU',
                ]);
            }
        });
    }
}
