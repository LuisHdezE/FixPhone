# FIXPHONE · Normalización de Modelos, Variantes e Imágenes

**Fecha:** 2026-10-17  
**Estado:** Propuesta arquitectónica aprobada con correcciones de diseño. **Sin migraciones ejecutadas en producción.**  
**Base de trabajo:** `main` @ `2df14fe300205dad3f7f7728a6af91e822b1a13e` (sincronizada con `origin/main`).  

---

## 1. Principios Rectores y Decisiones de Dominio

### 1.1. Persistencia local como única fuente de verdad
* **DeviceSpecsAPI es exclusivamente una fuente externa consultiva.** Nunca interviene en caliente ni en la cadena crítica de consultas operativas (altas de inventario, filtros de taller, showroom público, pedidos comerciales, valoraciones de ValuPhone o publicaciones).
* **Decisión administrativa explícita:** Ante cualquier consulta externa a DeviceSpecsAPI, el administrador tiene la potestad de:
  1. Crear un modelo o variante en FixPhone.
  2. Actualizar un modelo o variante existente.
  3. Incorporar selectivamente sólo determinados campos técnicos o imágenes.
  4. Rechazar los cambios por completo.
* **Cero llamadas automáticas en segundo plano:** No existen webhooks, enriquecimientos síncronos ni consultas dinámicas durante las operaciones habituales de taller, inventario o venta.

### 1.2. Herencia de especificaciones técnicas y variantes opcionales
* **Información común en el modelo:** Pantalla, batería, cámara, chipset, conectividad y sensores residen en `device_model_specs`.
* **Diferencias específicas en la variante:** RAM, almacenamiento comercial, código de región/fabricante y atributos distintivos residen en `device_model_variants`.
* **Variantes opcionales:** Un dispositivo físico puede asociarse únicamente al modelo base si aún no se conoce o no se precisa su variante exacta (`device_model_variant_id` nullable).
* **Sin duplicación en inventario:** Al registrar o consultar un equipo físico, sus especificaciones se resuelven en lectura cruzando con la base de datos local de FixPhone; nunca se duplican como columnas redundantes en `inventory_items`. El registro físico sólo almacena atributos particulares del ejemplar: IMEI/serie, código FXP, color, condición física, fallas, costos, destino, reparaciones y fotografías reales.

### 1.3. Dos niveles independientes de imágenes
* **Nivel 1 (Modelo o Variante):** Imágenes genéricas/oficiales obtenidas mediante DeviceSpecsAPI o cargadas manualmente por administración. Si la variante tiene imagen específica, prevalece sobre la del modelo.
* **Nivel 2 (Dispositivo físico de inventario):** Múltiples fotografías propias y reales del ejemplar físico, capturadas en recepción o taller, optimizadas en WebP y almacenadas en Cloudflare R2 asociadas al `inventory_item_id`.
* **Prohibición de ambigüedad en publicaciones:** Un equipo usado o reacondicionado individual debe exhibir sus fotografías reales. Queda prohibido presentar renders o imágenes genéricas simulando la condición física del equipo.

---

## 2. Compatibilidad Histórica de Fotografías

### 2.1. Diagnóstico del uso actual de `inventory_items.main_image_url`
Actualmente, `main_image_url` en `inventory_items`:
1. Aloja URLs absolutas (en su mayoría CDN de Cloudflare R2 o URLs externas de proveedores/consignantes).
2. Es consumido por el Showroom (`StorefrontCatalog`), el carrito de compras (`StorefrontCartController`), la publicación de teléfonos (`PhonePublicationController`), la publicación de repuestos y la extracción de componentes.
3. Se actualiza como una cadena simple en endpoints PATCH.

### 2.2. Estrategia de migración aditiva y no destructiva
* `inventory_items.main_image_url` **se conserva como columna de compatibilidad** (fallback de lectura rápida para showroom y endpoints legados).
* Se crea la tabla dedicada `inventory_device_photos` para modelar la galería física 1:N.
* Al marcar o confirmar una foto física como principal en `inventory_device_photos`, el backend actualiza de forma atómica y sincronizada el campo `inventory_items.main_image_url`.
* Para equipos históricos que ya posean `main_image_url` pero no tengan filas en `inventory_device_photos`, los consumidores de Showroom y API continúan leyendo `main_image_url` sin interrupción, identificándola con el flag `is_real_device_photo: false` (o `legacy_unverified`).

---

## 3. Eliminación Segura y Resiliente en Almacenamiento (R2)

Para evitar inconsistencias transaccionales cuando la API de Cloudflare R2 falle o sufra demoras:

1. **Eliminación diferida y auditable:** Al solicitar eliminar una fotografía física, el registro en base de datos se marca inmediatamente como `status = 'deleted'` o `pending_deletion`, ocultándolo al usuario en la galería activa.
2. **Cola de purga / Job reintentable (`media:prune-deleted`):** Un comando programado de mantenimiento procesa las eliminaciones físicas en R2 con reintentos exponenciales y registro en `audit_events`.
3. **Protección contra referencias compartidas:** Antes de emitir una orden de borrado en R2 sobre un `object_key`, se verifica que ninguna otra entidad (otra variante, valoración histórica o publicación) comparta la misma clave de almacenamiento.

---

## 4. Publicaciones Sociales y Reglas de Negocio

* **Condición de elegibilidad social:** Para publicar anuncios individuales de equipos usados o reacondicionados en redes (Facebook / Instagram), el sistema exige **al menos una fotografía real confirmada** en `inventory_device_photos`.
* **No bloqueante para flujos operativos:** La ausencia de fotografías físicas **no impide**:
  - El alta o registro del equipo en inventario (`InventoryDeviceIntakeModal`).
  - Su evaluación técnica ni su diagnóstico en taller.
  - La instalación o extracción de repuestos.
  - El cálculo de valoraciones en ValuPhone.
  - La visualización en el listado administrativo de inventario.
  - Publicaciones genéricas de catálogo explícitamente marcadas como ilustrativas.

---

## 5. Esquema Relacional de Base de Datos

```
+---------------------------+       +------------------------------------+
|    master_data_entries    | 1---1 |         device_model_specs         |
|  (kind = 'deviceModels')  |       +------------------------------------+
+---------------------------+       | id (ULID, PK)                      |
              | 1                   | device_model_id (FK master_data)   |
              |                     | specs_json (JSON)                  |
              | N                   | source_type, source_url            |
+---------------------------+       +------------------------------------+
|   device_model_variants   |
+---------------------------+
| id (ULID, PK)             |
| device_model_id (FK)      |
| variant_key (unique/model)|
| ram_capacity_id (FK)      |
| storage_capacity_id (FK)  |
| differences_json (JSON)   |
+---------------------------+
              | 1 (opcional)
              |
              | N (0..N)
+------------------------------------+
|          inventory_items           |
+------------------------------------+
| id (ULID, PK)                      |
| device_model_id (FK nullable)      |
| device_model_variant_id (FK null)  |
| serial_or_imei, cost, destination  |
| main_image_url (compatibilidad)    |
+------------------------------------+
              | 1
              |
              | N
+------------------------------------+
|      inventory_device_photos       |
+------------------------------------+
| id (ULID, PK)                      |
| inventory_item_id (FK)             |
| media_storage_profile_id (FK)      |
| object_key (VARCHAR 512)           |
| public_url (VARCHAR 2048)          |
| is_primary (BOOLEAN)               |
| sort_order (UNSIGNED INT)          |
| status (pending/confirmed/deleted) |
+------------------------------------+
```

---

## 6. Plan de Implementación por Pull Requests (PRs)

```
PR 1: Normalización de modelos, variantes, relaciones, herencia de características, ajustes de formularios y compatibilidad histórica
  ├── 1.1 Esquema e integridad referencial (device_model_media para variantes, DeviceModelReferenceGuard)
  ├── 1.2 DTOs y endpoints de resolución de herencia técnica (show con herencia calculada)
  ├── 1.3 Formularios de administración e intake (selección de modelo y variante opcional)
  └── 1.4 Suite de pruebas automatizadas y verificación de compatibilidad

PR 2: Fotografías propias y galería de dispositivos físicos
  ├── 2.1 Migración aditiva: tabla inventory_device_photos
  ├── 2.2 Endpoints seguros: presign, relay fallback, confirm, primary, reorder y soft-delete
  ├── 2.3 Mecanismo de eliminación diferida en R2 y limpieza de cargas huérfanas
  └── 2.4 Componente reutilizable DevicePhotoGalleryModal en inventario

PR 3: Integración de fotografías reales con showroom
  ├── 3.1 Actualización de StorefrontCatalog y endpoint showroomList con jerarquía de fallback
  ├── 3.2 Exposición del atributo booleano is_real_device_photo
  └── 3.3 Vista pública de producto con carrusel/galería física real y aviso de imagen ilustrativa

PR 4: Preparación de imágenes para publicaciones sociales
  ├── 4.1 Reglas de validación social (bloqueo si no hay fotos reales confirmadas)
  ├── 4.2 Generador de metadatos de publicación para Facebook/Instagram
  └── 4.3 Vista previa administrativa de publicación social

PR 5: Integración administrativa y selectiva con DeviceSpecsAPI
  ├── 5.1 Cliente HTTP consultivo hacia DeviceSpecsAPI (bajo demanda administrativa)
  ├── 5.2 Modal de comparación interactiva campo a campo (crear, actualizar, merge selectivo, rechazar)
  └── 5.3 Ingesta y optimización WebP de imágenes aceptadas directamente en Cloudflare R2
```
