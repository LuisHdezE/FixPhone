# ADR-177: Publicidad IA manual desde foto real de dispositivo

## Estado
Aceptado / Implementado

## Contexto y Motivación
Para potenciar la comercialización de teléfonos usados y reacondicionados en FixPhone, se requiere crear piezas publicitarias atractivas para redes sociales y catálogo comercial basadas en las fotos reales tomadas a cada equipo físico.

**Esta versión no utiliza una API de generación de imágenes.** La generación se realiza externamente de forma manual (por ejemplo, en ChatGPT), manteniendo el control humano sobre el diseño y evitando incurrir en costos o dependencias de APIs en esta etapa inicial.

## Reglas Arquitectónicas Fundamentales

1. **Activos Derivados vs. Fotografías Documentales:**
   - Las publicidades generadas son activos promocionales derivados.
   - **NO** se almacenan dentro de `inventory_item_photos`.
   - `inventory_item_photos` continúa representando de forma estricta y exclusiva las fotografías documentales reales del estado físico del dispositivo.
   - Se crea la entidad persistente independiente `inventory_item_promotional_assets`.

2. **Inmutabilidad de la Foto Fuente:**
   - Cada publicidad requiere una fotografía fuente (`source_photo_id`) que debe pertenecer obligatoriamente al mismo dispositivo físico (`inventory_item_id`) y estar en estado confirmado (`confirmed`).
   - La foto original nunca se modifica ni se sustituye.

3. **Inmutabilidad del Snapshot:**
   - Al preparar una publicidad con `PROMPT-0001`, FixPhone resuelve las variables desde los datos autoritativos del dispositivo y almacena un `prompt_snapshot` inmutable junto con `prompt_code` y `prompt_version`.
   - Si `PROMPT-0001` cambia en el futuro, el histórico de la publicidad preserva exactamente el texto que se utilizó.

4. **Tratamiento de Valores Vacíos (Sin Alucinaciones):**
   - Una variable ausente (por ejemplo, RAM, defectos o garantía) no produce texto inventado (nunca "RAM: 8 GB" ni "RAM: desconocida").
   - La línea correspondiente es omitida limpiamente del prompt resuelto, y se reporta una advertencia informativa no bloqueante en la interfaz.

5. **Aislamiento en Almacenamiento (Cloudflare R2):**
   - Los activos publicitarios utilizan una ruta/key independiente:
     `inventory/devices/{inventoryItemId}/promotional/{assetId}.{ext}`
   - Se reutiliza la infraestructura de presignado seguro (`R2Presigner`) y confirmación por backend (`HEAD`) sin duplicar lógica de almacenamiento.

## Flujo Operativo Manual (Fase 1)

```
Dispositivo físico (FXP-xxxx)
     ↓
Foto real confirmada
     ↓
[✨ Preparar publicidad]
     ↓
FixPhone recupera PROMPT-0001 + Resuelve variables reales
     ↓
Persiste InventoryItemPromotionalAsset (status: 'prepared') + prompt_snapshot
     ↓
Operador copia prompt y descarga/abre foto real
     ↓
Operador interactúa con ChatGPT (externo)
     ↓
Operador regresa a FixPhone y selecciona [Subir publicidad generada]
     ↓
Subida directa a R2 + Verificación backend HEAD (status: 'uploaded')
     ↓
Operador revisa preview y presiona:
     - [Aprobar] (status: 'approved', registra approved_by y approved_at)
     - [Descartar] (status: 'discarded', elimina archivo en R2)
```

## Extensión Futura: `AiImageProvider`

Para sustituir en el futuro el paso manual de ChatGPT por una generación automatizada sin rediseñar el dominio ni la base de datos, se diseña conceptualmente la abstracción `AiImageProvider`:

```php
namespace App\Domain\PromotionalAssets;

interface AiImageProvider
{
    /**
     * Envía la foto fuente y el prompt resuelto al proveedor externo de IA.
     * Retorna el stream binario o URL temporal de la imagen resultante.
     */
    public function generateImage(string $promptSnapshot, string $sourcePhotoUrl, array $options = []): GeneratedImageResult;
}
```

Implementaciones futuras posibles:
- `OpenAiImageProvider` (DALL-E / GPT-4o Vision Image Generation)
- `MidjourneyProvider`
- `LocalDiffusionProvider`

El controlador de FixPhone únicamente cambiaría de esperar una subida manual (`presign`/`confirm`) a disparar un Job en background que invoque `AiImageProvider::generateImage()`, almacene el resultado en R2 y lo deje en estado `uploaded` listo para aprobación humana.

## Matriz de Estados

- `prepared`: Prompt generado y resuelto con snapshot inmutable; esperando generación.
- `uploaded`: Imagen publicitaria cargada en R2 y verificada; en espera de revisión humana.
- `approved`: Publicidad revisada y aprobada para uso comercial.
- `discarded`: Publicidad descartada; se elimina el archivo en R2 para evitar costos innecesarios.
