<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\Inventory\Consignor;
use App\Infrastructure\Inventory\DeviceSaleRecord;
use App\Infrastructure\Inventory\DeviceInstalledPart;
use App\Infrastructure\Inventory\DeviceCodeAllocator;
use App\Infrastructure\RepairQuotes\RepairQuote;
use App\Infrastructure\Valuation\DeviceValuation;
use Carbon\Carbon;

class SeedMvpCommand extends Command
{
    protected $signature = 'fixphone:seed-mvp 
                            {--status : Mostrar el estado de los datos existentes}
                            {--backup : Generar un respaldo de la base de datos}
                            {--seed : Insertar los datos ficticios del MVP}
                            {--rollback : Eliminar únicamente los datos ficticios del MVP}
                            {--force : Ejecutar sin pedir confirmación}';

    protected $description = 'Gestiona la carga controlada de datos de prueba MVP en producción';

    public function handle()
    {
        if ($this->option('status')) {
            $this->showStatus();
            return 0;
        }

        if ($this->option('backup')) {
            return $this->generateBackup() ? 0 : 1;
        }

        if ($this->option('rollback')) {
            $this->rollbackMvp();
            return 0;
        }

        if ($this->option('seed')) {
            return $this->seedMvp() ? 0 : 1;
        }

        $this->info("Uso: php artisan fixphone:seed-mvp --status | --backup | --seed | --rollback");
        return 1;
    }

    private function showStatus()
    {
        $this->info("Estado de datos existentes:");
        $this->line("Items en Inventario: " . InventoryItem::count());
        $this->line("Consignantes: " . Consignor::count());
        $this->line("Ventas: " . DeviceSaleRecord::count());
        $this->line("Presupuestos: " . RepairQuote::count());
        $this->line("Tasaciones: " . DeviceValuation::count());
        $this->line("Repuestos instalados: " . DeviceInstalledPart::count());
    }

    private function generateBackup()
    {
        $this->warn("Respaldo automatizado deshabilitado. Se confía en el respaldo manual de phpMyAdmin del propietario.");
        return true;
    }

    private function rollbackMvp()
    {
        $this->info("Revirtiendo datos ficticios del MVP...");
        DB::transaction(function () {
            // Eliminar registros por Metadata MVP
            $mvpItemIds = InventoryItem::where('metadata->is_mvp_demo', true)->pluck('id');
            DeviceSaleRecord::whereIn('inventory_item_id', $mvpItemIds)->delete();
            DeviceInstalledPart::whereIn('inventory_item_id', $mvpItemIds)->delete();
            InventoryItem::whereIn('id', $mvpItemIds)->delete();

            // Eliminar por ID prefijo 01MVP
            RepairQuote::where('id', 'like', '01MVP%')->delete();
            DeviceValuation::where('id', 'like', '01MVP%')->delete();
            Consignor::where('id', 'like', '01MVP%')->delete();
        });
        $this->info("Reversión completada. Los datos productivos originales están intactos.");
    }

    private function seedMvp()
    {
        if (!$this->option('force') && !$this->confirm('¿Confirmas que deseas insertar datos ficticios MVP en ESTA base de datos?')) {
            $this->warn('Operación cancelada.');
            return false;
        }

        $this->info("Exigiendo respaldo previo obligatorio...");
        if (!$this->generateBackup()) {
            $this->error("No se pudo confirmar un respaldo válido. Abortando la carga de datos.");
            return false;
        }

        $this->info("Limpiando rastros MVP previos por seguridad...");
        $this->rollbackMvp();

        $this->info("Iniciando inserción controlada del dataset MVP...");
        DB::transaction(function () {
            // 1. Crear 30 consignantes ficticios
            $consignors = [];
            for ($i = 0; $i < 30; $i++) {
                $consignors[] = Consignor::create([
                    'id' => '01MVP0000000000000000000' . str_pad($i, 2, '0', STR_PAD_LEFT),
                    'full_name' => 'MVP Consignante ' . $i,
                    'document_number' => 'MVP' . $i,
                    'phone' => '0900MVP' . sprintf('%03d', $i),
                    'email' => 'mvp.consignante' . $i . '@demo.local',
                ]);
            }

            // 2. CASO FINANCIERO OBLIGATORIO (Venta 10k, Costo 4k, Repuestos 1k => Liquidacion 2.5k)
            $deviceRequired = InventoryItem::create([
                'id' => (string) Str::ulid(),
                'sku' => DeviceCodeAllocator::reserve(),
                'title' => 'iPhone MVP (Financiero)',
                'item_type' => 'used_phone',
                'brand' => 'Apple',
                'model' => 'iPhone MVP',
                'inventory_purpose' => 'sell_as_used_phone',
                'operational_status' => 'sold',
                'publication_status' => 'draft',
                'dismantling_status' => 'not_started',
                'is_sellable' => false,
                'stock_quantity' => 0,
                'cost_amount_minor' => 400000,
                'sale_price_amount_minor' => 1000000,
                'currency_code' => 'UYU',
                'metadata' => ['is_mvp_demo' => true],
            ]);
            
            DeviceInstalledPart::create([
                'id' => (string) Str::ulid(),
                'inventory_item_id' => $deviceRequired->id,
                'part_name' => 'Batería MVP',
                'cost_amount_minor' => 100000,
                'currency_code' => 'UYU',
                'installed_at' => Carbon::now()->subDays(2),
                'installed_by_actor_id' => 'mvp_admin',
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
                'sold_at' => Carbon::now()->subDays(1),
                'sold_by_actor_id' => 'mvp_admin',
                'status' => 'completed',
            ]);

            // 3. Generar 80 teléfonos propios
            for ($i = 0; $i < 80; $i++) {
                $isSold = ($i % 3) !== 0; 
                $isVoided = $isSold && ($i % 15 === 0); 
                $saleStatus = $isVoided ? 'voided' : 'completed';
                $operationalStatus = $isSold ? ($isVoided ? 'en_stock' : 'sold') : 'en_stock';

                $device = InventoryItem::create([
                    'id' => (string) Str::ulid(),
                    'sku' => DeviceCodeAllocator::reserve(),
                    'title' => 'Direct MVP ' . $i,
                    'item_type' => 'used_phone',
                    'inventory_purpose' => 'sell_as_used_phone',
                    'operational_status' => $operationalStatus,
                    'publication_status' => $operationalStatus === 'sold' ? 'draft' : 'publicado',
                    'is_sellable' => $operationalStatus !== 'sold',
                    'stock_quantity' => $operationalStatus === 'sold' ? 0 : 1,
                    'cost_amount_minor' => 200000,
                    'sale_price_amount_minor' => 500000,
                    'currency_code' => 'UYU',
                    'metadata' => ['is_mvp_demo' => true],
                ]);

                if ($isSold) {
                    DeviceSaleRecord::create([
                        'id' => (string) Str::ulid(),
                        'inventory_item_id' => $device->id,
                        'request_id' => (string) Str::uuid(),
                        'effective_sale_price_minor' => $device->sale_price_amount_minor,
                        'initial_cost_amount_minor' => $device->cost_amount_minor,
                        'installed_parts_cost_minor' => 0,
                        'currency_code' => 'UYU',
                        'inventory_purpose' => 'sell_as_used_phone',
                        'sold_at' => Carbon::now()->subMonths($i % 3)->subDays($i % 20),
                        'sold_by_actor_id' => 'mvp_admin',
                        'status' => $saleStatus,
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
                    'title' => 'Consigned MVP ' . $i,
                    'item_type' => 'used_phone',
                    'inventory_purpose' => 'consigned_phone',
                    'consignor_id' => $consignor->id,
                    'operational_status' => $isSold ? 'sold' : 'en_stock',
                    'publication_status' => 'draft',
                    'is_sellable' => !$isSold,
                    'stock_quantity' => $isSold ? 0 : 1,
                    'cost_amount_minor' => 0,
                    'sale_price_amount_minor' => 500000,
                    'currency_code' => 'UYU',
                    'metadata' => ['is_mvp_demo' => true],
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
                        'sold_at' => Carbon::now()->subMonths($i % 4)->subDays($i % 20),
                        'sold_by_actor_id' => 'mvp_admin',
                        'status' => 'completed',
                    ]);
                }
            }

            // 5. Rellenar hasta 200 con accesorios/repuestos
            for ($i = 0; $i < 59; $i++) {
                InventoryItem::create([
                    'id' => (string) Str::ulid(),
                    'sku' => DeviceCodeAllocator::reserve(),
                    'title' => 'MVP Part ' . $i,
                    'item_type' => 'spare_part',
                    'inventory_purpose' => 'sell_as_spare_part',
                    'operational_status' => 'en_stock',
                    'publication_status' => 'draft',
                    'is_sellable' => true,
                    'stock_quantity' => 10,
                    'cost_amount_minor' => 10000,
                    'sale_price_amount_minor' => 50000,
                    'currency_code' => 'UYU',
                    'metadata' => ['is_mvp_demo' => true],
                ]);
            }
            
            // 6. Presupuestos y Tasaciones MVP
            for ($i = 0; $i < 10; $i++) {
                RepairQuote::create([
                    'id' => '01MVP1000000000000000000' . str_pad($i, 2, '0', STR_PAD_LEFT),
                    'customer_name' => 'Cliente MVP ' . $i,
                    'customer_contact' => '0900MVP' . $i,
                    'device_description' => 'iPhone MVP ' . $i,
                    'device_tier' => 'tier_1',
                    'services' => [['name' => 'Diagnóstico', 'price_minor' => 50000]],
                    'parts' => [['name' => 'Pantalla LCD', 'cost_minor' => 150000]],
                    'parts_markup_percent' => 30,
                    'services_subtotal_minor' => 50000,
                    'parts_base_minor' => 150000,
                    'parts_total_minor' => 195000,
                    'courier_minor' => 0,
                    'discount_minor' => 0,
                    'total_minor' => 245000,
                    'currency_code' => 'UYU',
                    'notes' => 'Presupuesto MVP',
                    'created_by' => 'mvp_admin_ulid',
                    'created_at' => Carbon::now()->subDays($i),
                ]);
            }
            for ($i = 0; $i < 5; $i++) {
                DeviceValuation::create([
                    'id' => '01MVP2000000000000000000' . str_pad($i, 2, '0', STR_PAD_LEFT),
                    'model_name' => 'Samsung MVP ' . $i,
                    'fault_type' => 'pantalla_rota',
                    'screen_condition' => 'broken',
                    'power_state' => 'powers_on',
                    'estimated_min_minor' => 100000,
                    'estimated_max_minor' => 250000,
                    'asking_price_minor' => 200000,
                    'minimum_price_minor' => 150000,
                    'publication_status' => 'draft',
                    'market_reference' => 'Referencia MVP',
                    'notes' => 'Tasación MVP',
                    'created_by' => 'mvp_admin_ulid',
                    'created_at' => Carbon::now()->subDays($i),
                ]);
            }
        });

        $this->info("Dataset MVP insertado correctamente (200 items, 30 consignantes, ventas, cotizaciones).");
        return true;
    }
}
