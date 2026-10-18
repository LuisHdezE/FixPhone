<?php

namespace App\Application\PromotionalAssets;

use App\Infrastructure\Inventory\InventoryItem;
use App\Infrastructure\MasterData\DeviceSpecificationResolver;
use App\Infrastructure\MasterData\MasterDataEntry;

final class DevicePromptVariableResolver
{
    public function __construct(
        private readonly ?DeviceSpecificationResolver $specResolver = null
    ) {}

    /**
     * @return array{
     *   variables: array<string, ?string>,
     *   warnings: list<string>,
     *   summary: array<string, ?string>
     * }
     */
    public function resolve(InventoryItem $item): array
    {
        $meta = is_array($item->metadata) ? $item->metadata : [];

        // 1. codigo_fxp
        $codigoFxp = filled($item->sku) ? trim((string) $item->sku) : null;

        // 2. modelo
        $brand = filled($item->brand) ? trim((string) $item->brand) : '';
        $model = filled($item->model) ? trim((string) $item->model) : '';
        if ($model !== '') {
            $modelo = ($brand !== '' && !str_starts_with(strtolower($model), strtolower($brand)))
                ? "{$brand} {$model}"
                : $model;
        } elseif (filled($item->title)) {
            $modelo = trim((string) $item->title);
        } else {
            $modelo = null;
        }

        // 3. ram (Strictly from physical device)
        $ram = $meta['ram'] ?? $meta['ram_capacity'] ?? $meta['ram_label'] ?? $meta['physical_ram'] ?? null;
        if (is_string($ram)) {
            $ram = trim($ram) !== '' ? trim($ram) : null;
        } else {
            $ram = null;
        }

        // 4. almacenamiento (Strictly from physical device)
        $almacenamiento = $meta['storage'] ?? $meta['storage_capacity'] ?? null;
        if ((!$almacenamiento || trim((string) $almacenamiento) === '') && !empty($meta['storage_capacity_id'])) {
            $almacenamiento = $this->masterDataLabel($meta['storage_capacity_id']);
        }
        $almacenamiento = filled($almacenamiento) ? trim((string) $almacenamiento) : null;

        // 5. color
        $color = $meta['color'] ?? null;
        if ((!$color || trim((string) $color) === '') && !empty($meta['color_id'])) {
            $color = $this->masterDataLabel($meta['color_id']);
        }
        $color = filled($color) ? trim((string) $color) : null;

        // 6. condicion
        $condicion = $meta['condition_name'] ?? $meta['physical_condition'] ?? null;
        if ((!$condicion || trim((string) $condicion) === '') && !empty($meta['condition_id'])) {
            $condicion = $this->masterDataLabel($meta['condition_id']);
        }
        $condicion = filled($condicion) ? trim((string) $condicion) : null;

        // 7. precio & 8. moneda
        $precio = null;
        $moneda = null;
        $missingCurrencyForPrice = false;

        if ($item->sale_price_amount_minor !== null && (int) $item->sale_price_amount_minor > 0) {
            $minor = (int) $item->sale_price_amount_minor;
            $val = $minor / 100;
            $precio = ($minor % 100 === 0)
                ? number_format($val, 0, ',', '.')
                : number_format($val, 2, ',', '.');

            // Strictly use existing currency code; never assume or default to USD
            if (filled($item->currency_code)) {
                $moneda = trim((string) $item->currency_code);
            } else {
                $moneda = null;
                $missingCurrencyForPrice = true;
            }
        }

        // 9. defectos (Authoritative only, never deduced)
        $defectos = $meta['defects'] ?? $meta['defectos'] ?? $meta['faults'] ?? $meta['physical_flaws'] ?? null;
        if (is_array($defectos)) {
            $defectos = implode(', ', array_filter(array_map('trim', $defectos)));
        }
        $defectos = filled($defectos) ? trim((string) $defectos) : null;

        // 10. garantia (Explicit configuration only, never hardcoded "1 mes")
        $garantia = $meta['warranty'] ?? $meta['garantia'] ?? $meta['warranty_period'] ?? null;
        $garantia = filled($garantia) ? trim((string) $garantia) : null;

        // 11. caracteristicas_destacadas (From authoritative metadata or inherited model specs)
        $caracteristicas = $meta['highlights'] ?? $meta['features'] ?? null;
        if (!$caracteristicas && $this->specResolver !== null && $item->device_model_id !== null) {
            $specData = $this->specResolver->forDevice($item);
            $effective = $specData['inherited']['effective'] ?? [];
            $picked = [];
            foreach (['display', 'screen', 'pantalla', 'chip', 'processor', 'procesador', 'camera', 'camara', 'battery', 'bateria'] as $k) {
                if (!empty($effective[$k]) && is_string($effective[$k])) {
                    $picked[] = trim($effective[$k]);
                }
            }
            if (!empty($picked)) {
                $caracteristicas = implode(', ', array_slice($picked, 0, 3));
            }
        }
        if (is_array($caracteristicas)) {
            $caracteristicas = implode(', ', array_filter(array_map('trim', $caracteristicas)));
        }
        $caracteristicas = filled($caracteristicas) ? trim((string) $caracteristicas) : null;

        // If price exists but currency is missing, omit the commercial block for prompt variables
        // so that no false currency is attributed to the advertisement.
        $promptPrecio = ($precio !== null && $moneda !== null) ? $precio : null;
        $promptMoneda = ($precio !== null && $moneda !== null) ? $moneda : null;

        $variables = [
            'codigo_fxp' => $codigoFxp,
            'modelo' => $modelo,
            'ram' => $ram,
            'almacenamiento' => $almacenamiento,
            'color' => $color,
            'condicion' => $condicion,
            'precio' => $promptPrecio,
            'moneda' => $promptMoneda,
            'defectos' => $defectos,
            'garantia' => $garantia,
            'caracteristicas_destacadas' => $caracteristicas,
        ];

        $warnings = [];
        if ($precio === null) {
            $warnings[] = 'No hay precio publicado o configurado para el dispositivo.';
        } elseif ($missingCurrencyForPrice) {
            $warnings[] = 'Moneda no especificada para el precio del dispositivo.';
        }

        if ($ram === null) {
            $warnings[] = 'Memoria RAM ausente en el registro físico del dispositivo.';
        }
        if ($almacenamiento === null) {
            $warnings[] = 'Almacenamiento ausente en el registro físico del dispositivo.';
        }
        if ($color === null) {
            $warnings[] = 'Color no especificado en el dispositivo.';
        }
        if ($condicion === null) {
            $warnings[] = 'Condición física ausente.';
        }

        return [
            'variables' => $variables,
            'warnings' => $warnings,
            'summary' => [
                'codigo_fxp' => $codigoFxp,
                'modelo' => $modelo,
                'precio' => $precio,
                'moneda' => $moneda,
                'ram' => $ram,
                'almacenamiento' => $almacenamiento,
                'color' => $color,
                'condicion' => $condicion,
                'defectos' => $defectos,
                'garantia' => $garantia,
                'caracteristicas_destacadas' => $caracteristicas,
            ],
        ];
    }

    /**
     * Replaces variables into the template in a deterministic and clean way.
     * Prunes dynamic data lines whose variable is absent without leaving empty placeholders.
     * Preserves all instruction, fidelity, safety, and rule lines intact without accidental deletion.
     */
    public function applyTemplate(string $template, array $variables): string
    {
        $lines = preg_split("/\r\n|\n|\r/", $template);
        $resultLines = [];

        foreach ($lines as $line) {
            $isDataField = $this->isDynamicDataFieldLine($line);

            if ($isDataField) {
                // Dynamic data field lines (e.g. "RAM: {{ram}}", "- Precio: {{precio}} {{moneda}}")
                $modified = $line;

                // Handle combined pairs like "- Dispositivo: {{modelo}} ({{codigo_fxp}})"
                if (str_contains($modified, '{{modelo}}') && str_contains($modified, '{{codigo_fxp}}')) {
                    if (!empty($variables['modelo']) && !empty($variables['codigo_fxp'])) {
                        $modified = str_replace(['{{modelo}}', '{{codigo_fxp}}'], [$variables['modelo'], $variables['codigo_fxp']], $modified);
                    } elseif (!empty($variables['modelo'])) {
                        $modified = preg_replace('/\s*\(\{\{codigo_fxp\}\}\)/', '', $modified);
                        $modified = str_replace('{{modelo}}', $variables['modelo'], $modified);
                    } elseif (!empty($variables['codigo_fxp'])) {
                        $modified = preg_replace('/\{\{modelo\}\}\s*\(/', '', $modified);
                        $modified = str_replace(['{{codigo_fxp}}', ')'], [$variables['codigo_fxp'], ''], $modified);
                    } else {
                        continue;
                    }
                }

                // Handle combined price and currency: "- Precio: {{precio}} {{moneda}}"
                if (str_contains($modified, '{{precio}}') || str_contains($modified, '{{moneda}}')) {
                    if (!empty($variables['precio']) && !empty($variables['moneda'])) {
                        $modified = str_replace('{{precio}}', $variables['precio'], $modified);
                        $modified = str_replace('{{moneda}}', $variables['moneda'], $modified);
                        $modified = trim($modified);
                    } else {
                        // If either price or currency is missing, omit the commercial line
                        continue;
                    }
                }

                // Replace remaining variables on data field line
                $omitLine = false;
                foreach ($variables as $key => $val) {
                    $tag = '{{' . $key . '}}';
                    if (str_contains($modified, $tag)) {
                        if ($val !== null && trim((string) $val) !== '') {
                            $modified = str_replace($tag, trim((string) $val), $modified);
                        } else {
                            // Missing dynamic data value -> omit line
                            $omitLine = true;
                            break;
                        }
                    }
                }

                if ($omitLine) {
                    continue;
                }

                // If line still contains any unresolved {{variable}}, skip it
                if (preg_match('/\{\{[a-zA-Z0-9_\-]+\}\}/', $modified)) {
                    continue;
                }

                $resultLines[] = $modified;
            } else {
                // Rule, safety, instruction, and descriptive prose lines (MUST BE PRESERVED)
                $modified = $line;

                foreach ($variables as $key => $val) {
                    $tag = '{{' . $key . '}}';
                    if (str_contains($modified, $tag)) {
                        if ($val !== null && trim((string) $val) !== '') {
                            $modified = str_replace($tag, trim((string) $val), $modified);
                        } else {
                            // In instruction/rule lines, replace with non-fabricating representation
                            $fallback = $this->ruleFallbackFor($key);
                            $modified = str_replace($tag, $fallback, $modified);
                        }
                    }
                }

                // Clean up any double spaces that might occur from empty replacements
                $modified = preg_replace('/[ \t]{2,}/', ' ', $modified);

                $resultLines[] = $modified;
            }
        }

        $result = implode("\n", $resultLines);
        return preg_replace("/\n{3,}/", "\n\n", trim($result));
    }

    /**
     * Determines whether a line is a pure dynamic key-value data field line.
     * (e.g. "RAM: {{ram}}", "- RAM: {{ram}}", "Precio: {{precio}} {{moneda}}", etc.)
     */
    private function isDynamicDataFieldLine(string $line): bool
    {
        $trimmed = trim($line);
        if ($trimmed === '') {
            return false;
        }

        return (bool) preg_match('/^[-*•]?\s*[^:\n]+:\s*(\{\{[a-zA-Z0-9_\-]+\}\}|\(\{\{[a-zA-Z0-9_\-]+\}\}\)|\{\{[a-zA-Z0-9_\-]+\}\}\s*\{\{[a-zA-Z0-9_\-]+\}\}|\{\{[a-zA-Z0-9_\-]+\}\}\s*\(\{\{[a-zA-Z0-9_\-]+\}\}\))\s*$/u', $trimmed);
    }

    /**
     * Non-fabricating fallback for placeholders appearing inside instruction or rule sentences.
     */
    private function ruleFallbackFor(string $variable): string
    {
        return match ($variable) {
            'defectos' => '(ninguno declarado)',
            'caracteristicas_destacadas' => '(ninguna declarada)',
            'garantia' => '(no especificada)',
            'ram' => '(no especificada)',
            'almacenamiento' => '(no especificado)',
            'color' => '(no especificado)',
            'condicion' => '(no especificada)',
            'precio' => '(no especificado)',
            'moneda' => '',
            'codigo_fxp' => '(sin código)',
            'modelo' => 'el dispositivo',
            default => '',
        };
    }

    private function masterDataLabel(?string $id): ?string
    {
        if (!$id) {
            return null;
        }
        $entry = MasterDataEntry::query()->whereKey($id)->first();
        if (!$entry || !is_array($entry->payload)) {
            return null;
        }
        return $entry->payload['label'] ?? $entry->payload['name'] ?? null;
    }
}
