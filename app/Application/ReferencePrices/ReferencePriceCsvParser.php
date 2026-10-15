<?php

namespace App\Application\ReferencePrices;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ReferencePriceCsvParser
{
    public const HEADER = [
        'source', 'source_country', 'source_url', 'observed_date', 'brand', 'model',
        'service_code', 'service_name', 'currency', 'price_amount',
        'tax_included', 'price_type', 'notes',
    ];

    private const MINOR_DIGITS = [
        'EUR' => 2, 'UYU' => 2, 'USD' => 2, 'GBP' => 2, 'ARS' => 2,
        'BRL' => 2, 'CAD' => 2, 'MXN' => 2, 'COP' => 2, 'PEN' => 2,
        'JPY' => 0, 'KRW' => 0, 'CLP' => 0,
        'KWD' => 3, 'BHD' => 3, 'OMR' => 3,
    ];

    /**
     * A syntactic and consistency check. The import does not independently
     * attest that cited sources published the values.
     *
     * @return array{valid:bool, rows:array, preview:array, summary:array, errors:array}
     */
    public function parse(UploadedFile $file): array
    {
        if (strtolower($file->getClientOriginalExtension()) !== 'csv') {
            throw ValidationException::withMessages(['file' => 'Seleccioná un archivo .csv.']);
        }

        $bytes = file_get_contents($file->getRealPath());
        if ($bytes === false || $bytes === '' || strlen($bytes) > 1024 * 1024 ||
            !mb_check_encoding($bytes, 'UTF-8') || str_contains($bytes, "\0")) {
            throw ValidationException::withMessages(['file' => 'El CSV debe ser UTF-8 válido y medir hasta 1 MB.']);
        }

        $stream = fopen('php://temp', 'w+');
        if ($stream === false) {
            throw ValidationException::withMessages(['file' => 'No fue posible leer el CSV.']);
        }
        fwrite($stream, preg_replace('/^\xEF\xBB\xBF/', '', $bytes));
        rewind($stream);
        $header = fgetcsv($stream, 0, ',', '"', '');
        if ($header !== self::HEADER) {
            fclose($stream);
            throw ValidationException::withMessages([
                'file' => 'Encabezados incorrectos. Usá exactamente las 13 columnas definidas en el prompt PRICE_REF_001, con comas y en el orden previsto.',
            ]);
        }

        $validRows = [];
        $preview = [];
        $errors = [];
        $errorsCount = 0;
        $duplicatesFile = 0;
        $seen = [];
        $logicalKeys = [];
        $line = 1;
        $rowCount = 0;

        while (($values = fgetcsv($stream, 0, ',', '"', '')) !== false) {
            $line++;
            if ($values === [null]) continue;
            $rowCount++;
            if ($rowCount > 2000) {
                fclose($stream);
                throw ValidationException::withMessages(['file' => 'El límite es 2.000 filas de precios por archivo.']);
            }
            if (count($values) !== 13) {
                $this->addError($errors, $errorsCount, $line, 'Se esperaban exactamente 13 columnas.');
                continue;
            }

            $row = array_combine(self::HEADER, array_map('trim', $values));
            $problem = $this->validateRow($row);
            if ($problem !== null) {
                $this->addError($errors, $errorsCount, $line, $problem);
                continue;
            }

            $digits = self::MINOR_DIGITS[$row['currency']];
            $pieces = explode('.', $row['price_amount'], 2);
            $major = (int) $pieces[0];
            $minor = (int) str_pad($pieces[1] ?? '', $digits, '0');
            $row['price_minor'] = $major * (10 ** $digits) + $minor;
            $row['minor_digits'] = $digits;
            $row['price_amount'] = $pieces[0].($digits > 0 ? '.'.str_pad($pieces[1] ?? '', $digits, '0') : '');
            $row['notes'] = $row['notes'] === '' ? null : $row['notes'];

            $hash = hash('sha256', json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
            $row['row_sha256'] = $hash;

            // One price per (source, market, model, service option, day).
            // Distinct service names let a provider distinguish repair tiers.
            $logicalKey = implode('|', [
                $row['source'], $row['source_country'], mb_strtolower($row['brand']),
                mb_strtolower($row['model']), $row['service_code'],
                mb_strtolower($row['service_name']), $row['currency'],
                $row['observed_date'], $row['price_type'],
            ]);
            if (isset($logicalKeys[$logicalKey]) && $logicalKeys[$logicalKey] !== $hash) {
                $this->addError($errors, $errorsCount, $line, 'Dos importes/condiciones distintos para el mismo servicio y fecha; separá las variantes por nombre.');
                continue;
            }
            $logicalKeys[$logicalKey] = $hash;

            if (isset($seen[$hash])) {
                $duplicatesFile++;
                continue;
            }
            $seen[$hash] = true;
            $validRows[] = $row;
        }
        fclose($stream);

        if ($rowCount === 0) {
            throw ValidationException::withMessages(['file' => 'El CSV está vacío: no hay precios para importar.']);
        }

        $existing = [];
        foreach (array_chunk(array_keys($seen), 200) as $chunk) {
            foreach (DB::table('reference_price_observations')->whereIn('row_sha256', $chunk)->pluck('row_sha256') as $hash) {
                $existing[$hash] = true;
            }
        }

        $newCount = 0;
        foreach ($validRows as $row) {
            $isNew = !isset($existing[$row['row_sha256']]);
            if ($isNew) $newCount++;
            if (count($preview) < 20) {
                $preview[] = [
                    'source' => $row['source'], 'model' => $row['model'],
                    'service_name' => $row['service_name'], 'observed_date' => $row['observed_date'],
                    'currency' => $row['currency'], 'price_amount' => $row['price_amount'],
                    'status' => $isNew ? 'new' : 'duplicate',
                ];
            }
        }

        return [
            'valid' => $errorsCount === 0,
            'rows' => $validRows,
            'preview' => $preview,
            'summary' => [
                'total' => $rowCount, 'new' => $newCount,
                'duplicate' => count($existing) + $duplicatesFile,
                'errors' => $errorsCount,
            ],
            'errors' => $errors,
        ];
    }

    private function validateRow(array $row): ?string
    {
        if (!in_array($row['source'], ['APPLE', 'MUNDOMAC'], true)) return 'Fuente no permitida (APPLE o MUNDOMAC).';
        if (!preg_match('/^[A-Z]{2}$/D', $row['source_country'])) return 'El mercado debe ser un código ISO de dos letras.';
        if ($row['source'] === 'MUNDOMAC' && $row['source_country'] !== 'UY') return 'MundoMac debe indicar el mercado UY.';
        if (strlen($row['source_url']) > 2048 || !filter_var($row['source_url'], FILTER_VALIDATE_URL)) return 'La URL de la fuente es inválida.';
        $parts = parse_url($row['source_url']);
        $host = strtolower($parts['host'] ?? '');
        $domain = $row['source'] === 'APPLE' ? 'apple.com' : 'mundomac.com';
        if (($parts['scheme'] ?? '') !== 'https' || isset($parts['user']) || isset($parts['pass']) ||
            ($host !== $domain && !str_ends_with($host, '.'.$domain))) {
            return 'La URL HTTPS no corresponde al dominio de la fuente indicada.';
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $row['observed_date'])) return 'Fecha inválida: usá YYYY-MM-DD.';
        [$year, $month, $day] = array_map('intval', explode('-', $row['observed_date']));
        if (!checkdate($month, $day, $year) || $year < 2020 || $row['observed_date'] > date('Y-m-d')) {
            return 'Fecha de observación inválida o futura.';
        }

        if ($row['brand'] !== 'Apple') return 'La marca debe ser Apple.';
        if (!str_starts_with($row['model'], 'iPhone ') || mb_strlen($row['model']) > 160) return 'El modelo debe indicar un iPhone específico.';
        if (!in_array($row['service_code'], ['BATTERY', 'SCREEN', 'BACK_GLASS', 'CAMERA', 'OTHER_DAMAGE'], true)) {
            return 'Tipo de servicio no reconocido.';
        }
        if ($row['service_name'] === '' || mb_strlen($row['service_name']) > 160) return 'Nombre de servicio vacío o demasiado largo.';
        if (!array_key_exists($row['currency'], self::MINOR_DIGITS)) return 'Moneda no configurada: no se puede calcular su precisión sin su regla ISO.';
        if (!preg_match('/^(0|[1-9]\d{0,8})(?:\.(\d{1,3}))?$/D', $row['price_amount'])) {
            return 'Importe inválido: usá números decimales positivos sin símbolos ni rangos.';
        }
        $pieces = explode('.', $row['price_amount'], 2);
        if (strlen($pieces[1] ?? '') > self::MINOR_DIGITS[$row['currency']] ||
            (float) $row['price_amount'] <= 0) {
            return 'Importe cero o con precisión no admitida para la moneda.';
        }
        if (!in_array($row['tax_included'], ['yes', 'no', 'unknown'], true)) return 'Impuestos: yes, no o unknown.';
        if (!in_array($row['price_type'], ['published_estimate', 'published_price'], true)) return 'Tipo de precio no válido.';
        if (mb_strlen($row['notes']) > 1000) return 'Notas demasiado largas (máximo 1.000 caracteres).';
        foreach (['model', 'service_name', 'notes'] as $key) {
            if (preg_match('/^[=+\-@]/u', ltrim($row[$key])) || preg_match('/[\x00-\x08\x0B\x0E-\x1F]/', $row[$key])) {
                return 'Contenido potencialmente inseguro en '.$key.'.';
            }
        }
        return null;
    }

    private function addError(array &$errors, int &$total, int $line, string $reason): void
    {
        $total++;
        if (count($errors) < 30) $errors[] = ['row' => $line, 'message' => $reason];
    }
}
