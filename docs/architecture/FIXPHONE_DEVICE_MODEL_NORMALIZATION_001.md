# FIXPHONE · Normalización de modelos, variantes y fichas técnicas

Fecha: 2026-10-15. Estado: propuesta de diseño técnico, **sin migraciones aplicadas**.
Base auditada: `main` @ `4a59489a304123580946397b155fe4c52af8c76d`.

## 1. Objetivo y límites
Compartir especificaciones del modelo, diferenciar configuraciones comerciales y conservar exclusivamente en inventario los datos propios de cada unidad. No modificar DeviceSpecsAPI, no publicar automáticamente fichas o imágenes ni tocar producción. Respetar el flujo de despiece de PR #107 y la auditoría financiera.

## 2. Hallazgos confirmados
- `master_data_entries` es el catálogo actual, con `id` string PK, `kind` y `payload` JSON; los modelos están en `kind=deviceModels`.
- `inventory_items` contiene `brand`/`model` textuales, `metadata.device_model_id`, `metadata.storage_capacity_id`, y `main_image_url`.
- El intake actual guarda la identidad del catálogo en metadata y captura almacenamiento por separado.
- `DeviceInventoryCrudController` valida catálogo y protege historial de extracciones, ventas y movimientos. La PR #107 incorporó `device_part_extractions`; sus variantes de *pieza recuperada* no son variantes comerciales del teléfono.
- La arquitectura vigente exige migraciones versionadas, integridad referencial, medios externos y conservación de historia.

## 3. Esquema propuesto (pendiente de validación mediante pruebas)

### master_data_entries
Se conserva como autoridad de marcas y modelos. No duplicar la ficha de identidad del modelo en otra tabla. Sus `id` no se deben regenerar. Validar coherencia `kind=deviceModels` en aplicación y durante backfill; una FK aislada por `id` NO garantiza el `kind`.

### device_model_specs
- `id` ULID PK
- `device_model_id` string NOT NULL UNIQUE, FK `master_data_entries.id`, RESTRICT
- `specs_json` JSON NOT NULL: campos comunes documentados con unidad explícita y valores desconocidos nulos; no guardar aquí RAM/almacenamiento si dependen de variante
- `source_type` enum/validated string (manual, devicespecsapi, other)
- `source_url`, `source_reference`, `fetched_at`, `reviewed_at`, `reviewed_by`, `schema_version`, timestamps
- `status` draft/reviewed, sin publicación por defecto

### device_model_variants
- `id` ULID PK
- `device_model_id` string NOT NULL FK `master_data_entries.id`, RESTRICT
- `name`, `ram_capacity_id` nullable FK catálogo, `storage_capacity_id` nullable FK catálogo, `region_code` nullable, `manufacturer_variant_code` nullable, `differences_json` JSON nullable, `active`, timestamps
- Identidad normalizada de variante mediante `variant_key` generada por aplicación, UNIQUE(`device_model_id`, `variant_key`); los nulos no deben permitir duplicados semánticos.
- Las capacidades pueden referenciar las entradas maestras actuales; validar en servicio que sean tipos correctos, además de FK.

### device_model_media
- `id` ULID PK, `device_model_id` FK, `storage_disk`, `object_key`, `media_type`, `sort_order`, `is_primary`, `source_url`, `attribution`, `license_status`, `reviewed_at`, timestamps.
- Guardar claves de R2, no URLs públicas rígidas ni binarios. Garantizar una sola primaria mediante servicio/transacción y estrategia de índice compatible con MySQL/SQLite. No importar imágenes de terceros sin autorización.

### inventory_items (migración aditiva)
- `device_model_id` nullable string FK `master_data_entries.id` y su índice.
- `device_model_variant_id` nullable ULID FK `device_model_variants.id` e índice.
- Validación transaccional: variante pertenece al modelo, modelo es del catálogo y es del tipo `deviceModels`; brandId del modelo corresponde a marca seleccionada.
- Restricción funcional: sólo `item_type` de dispositivo puede asignar estos campos; repuestos recuperados siguen usando compatibilidad existente.
- Conservar `brand`, `model` y metadatos antiguos de forma temporal para lecturas legadas e históricos; no convertir el catálogo vivo en fuente de verdad retroactiva para ventas cerradas.

## 4. Lectura y escritura
- API de ficha: modelo + especificaciones comunes + variantes + medios, con DTO propio y permisos de administración para escritura.
- En alta: seleccionar marca/modelo, cargar ficha y variantes; campos físicos (IMEI, color, estado, bloqueos, costo, destino, fotos reales) se editan por unidad.
- Foto: propia -> primaria del modelo -> placeholder, con diferenciación visual.
- Edición y auditoría: cambios de referencias sujetos a protecciones actuales para equipos con extracciones/ventas y a registro de antes/después.
- Catálogo administrativo con modales compactos. Consulta a DeviceSpecsAPI será una fase separada y siempre revisada antes de persistir.

## 5. Backfill no destructivo
1. Migration add-only de tablas/FK nullable; respaldos y verificación de versión MySQL/SQLite antes de despliegue.
2. Script dry-run que inventarie valores `metadata.device_model_id`, `brand`, `model`, `storage_capacity_id` y `ram_capacity_id`, detecte huérfanos, marcas incompatibles y duplicados.
3. Sólo resolver coincidencias por ID válido; cuando falte, presentar reporte para revisión manual y dejar FK NULL. Nunca inferir coincidencia sólo por texto ambiguo.
4. Crear variantes verificadas por combinaciones reales cuando corresponda y asociar unidades con trazabilidad. No inventar RAM.
5. Compatibilidad lectura anterior durante transición, con observabilidad; retirar legado en PR posterior y tras aceptar cobertura.
6. No ejecutar el backfill ni borrados en producción sin revisión de resultados y autorización explícita.

## 6. Pruebas de aceptación
- FK invalidas y `kind` equivocado rechazados; variante de otro modelo rechazada.
- Catálogo existente intacto, modelos/variantes sin duplicados, capacidades opcionales válidas.
- Modelo nuevo sin ficha ni variantes sigue siendo seleccionable.
- Selección de modelo no copia especificaciones a `inventory_items.metadata`.
- Foto propia prioritaria y fallback del modelo sin publicación automática.
- Venta, propiedad, evaluaciones, despiece idempotente PR #107 y reventa conservan invariantes.
- Backfill dry-run y repetición idempotente; datos ambiguos reportados, nunca adivinados.
- Autorización, auditoría, validación de medios, tests Laravel SQLite/MySQL según disponibilidad y typecheck/build web.

## 7. Entrega por PR
1. Diseño, inventario de dependencias y pruebas de esquema.
2. Migraciones aditivas y modelos/repositorios.
3. API y contratos con pruebas.
4. Backfill de prueba + reportes.
5. Catálogo admin e imágenes.
6. Intake/consulta/edición.
7. Integración futura DeviceSpecsAPI con revisión humana.

No mezclar este trabajo con el árbol local sucio de Elena (`feature/inventory-devices-compact-actions`). Crear worktree independiente de `origin/main` actualizado al iniciar implementación.
