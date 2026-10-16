<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Schema;

/**
 * Safe to rerun in production: never overwrites administrator-edited prompts.
 */
final class AiPromptCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $content = <<<'FIXPHONE_PROMPT'
Quiero actualizar los PRECIOS DE REFERENCIA DE REPARACIÓN de mi sistema FixPhone (Uruguay).

Esta es una tarea completa e independiente. No dependas de conversaciones anteriores. Consultá ahora fuentes públicas oficiales, buscá las tarifas disponibles y entregame un archivo CSV real descargable, listo para importar en FixPhone. NO hagas cambios en mi repositorio ni inventes tarifas.

FUENTES OBLIGATORIAS
1. APPLE: https://support.apple.com/es-es/iphone/repair
   Usá el estimador oficial de reparación de Apple, indicando el país real de la página consultada (por ejemplo ES). Si Apple no publica una tarifa para Uruguay, NO presentes una tarifa de otro país como uruguaya. Podés usar otra página regional oficial de Apple si sirve para verificar datos, indicando su país exacto y URL específica.
2. MUNDOMAC: https://soporte.mundomac.com/iPhone/
   Usá las tarifas públicas efectivamente comprobables de MundoMac en Uruguay. No des por hecho que es un precio uniforme de Apple.

COBERTURA
- Intentá incluir todos los modelos de iPhone para los que cada fuente realmente publique un precio verificable, incluidas variantes Pro, Max, Plus, mini, SE y nuevos modelos si aparecen.
- Consultá, si la fuente los distingue: BATTERY (batería), SCREEN (pantalla), BACK_GLASS (vidrio/tapa trasera), CAMERA (cámara) y OTHER_DAMAGE (otros daños).
- Cada fila representa una combinación única de fuente, país, modelo, tipo de reparación y precio publicado. Si hay varias opciones de reparación claramente distintas, explicá la diferencia en notes; no combines precios incompatibles.
- No fabriques equivalencias de servicios, descuentos, tipos de pantalla, modelos ni precios. Si una fuente no muestra el importe o requiere un presupuesto individual, excluí la fila e informalo al finalizar.

CSV DE IMPORTACIÓN
Nombre del archivo: fixphone_precios_referencia_YYYY-MM-DD.csv, reemplazando la fecha con la fecha REAL de la consulta.
Codificación UTF-8, formato CSV separado por comas, encabezados EXACTOS y en este orden:
source,source_country,source_url,observed_date,brand,model,service_code,service_name,currency,price_amount,tax_included,price_type,notes

Reglas de las columnas:
- source: APPLE o MUNDOMAC, exactamente.
- source_country: código ISO 3166-1 alfa-2 del mercado publicado (por ejemplo ES, UY).
- source_url: URL completa y verificable que respalda el dato.
- observed_date: fecha real de verificación en YYYY-MM-DD, no una fecha de vigencia inventada.
- brand: Apple.
- model: denominación completa del modelo, tal como se puede identificar sin ambigüedad (ej.: iPhone 15 Pro Max).
- service_code: BATTERY, SCREEN, BACK_GLASS, CAMERA u OTHER_DAMAGE.
- service_name: descripción clara y específica del servicio publicado.
- currency: código ISO 4217 de la moneda realmente publicada (por ejemplo EUR, UYU).
- price_amount: precio decimal sin símbolo de moneda y sin separadores de miles, usando punto decimal (ej.: 249.00); no escribir intervalos, «desde» ni valores ambiguos.
- tax_included: yes, no o unknown, exclusivamente según evidencia.
- price_type: published_estimate o published_price, según cómo lo presente la fuente.
- notes: condiciones, limitaciones, impuestos no aclarados, piezas intercambiadas u otras advertencias verificadas; comillas y comas escapadas correctamente según CSV.

REQUISITOS DE CALIDAD
- No incluyas precios supuestos, vacíos, caducados que no hayas podido validar ni datos inventados.
- Si se muestra un rango, precio «desde» o una estimación condicional sin importe exacto atribuible al servicio, omití la fila y explicá la exclusión.
- No conviertas EUR a UYU ni combines mercados; cada precio conserva su moneda y país originales.
- Evitá duplicados idénticos. Escapá campos CSV según RFC 4180 (entrecomillado cuando corresponda) y evitá que textos comiencen con fórmulas de hoja de cálculo (=, +, -, @).
- Verificá que todas las filas tengan 13 columnas, fechas válidas, fuente autorizada y el encabezado literal pedido.
- Guardá el CSV como archivo descargable, no solo como bloque de código ni tabla Markdown. Si existe una herramienta para crear archivos, utilizala.

ENTREGA
1. Enlace de descarga del CSV compatible con FixPhone.
2. Breve resumen: fecha de consulta, cantidad de filas por fuente, modelos y servicios cubiertos.
3. Fuentes y enlaces utilizados; indicá qué país/moneda corresponde a cada una.
4. Lista clara de precios/servicios excluidos por falta de evidencia, restricciones de acceso o ausencia de importe público.
Si ninguna tarifa se puede verificar, NO fabriques un CSV con precios: explicá el bloqueo y qué fuentes se pudieron consultar.

El objetivo es ejecutar este mismo procedimiento periódicamente simplemente pegando este texto en un chat nuevo.
FIXPHONE_PROMPT;

        DB::transaction(function () use ($content): void {
            $id = (string) Str::ulid();
            $created = DB::table('ai_prompts')->insertOrIgnore([
                'id' => $id,
                'code' => 'PRICE_REF_001',
                'description' => 'Actualizar precios de reparación Apple y MundoMac (CSV FixPhone)',
                'content' => $content,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            if ($created === 1 && Schema::hasTable('ai_prompt_revisions')) {
                DB::table('ai_prompt_revisions')->insert([
                    'id' => (string) Str::ulid(),
                    'ai_prompt_id' => $id,
                    'version' => 1,
                    'description' => 'Actualizar precios de reparación Apple y MundoMac (CSV FixPhone)',
                    'content' => $content,
                    'action' => 'seeded',
                    'actor_id' => null,
                    'created_at' => now(),
                ]);
            }
        });
    }
}
