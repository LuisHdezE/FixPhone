# FXP-048 · Recuperación de acciones del Inventario operativo

## Hallazgo

`/applications/management/inventory` utilizaba **seis filas simuladas** definidas en `mockInventoryRepository.ts`; sus cantidades, fechas relativas y alertas no procedían de MySQL. No tenía una columna de acciones. El endpoint `GET /api/v1/admin/inventory` existente corresponde solo a **Dispositivos**, no al inventario completo. No había rutas seguras para editar datos de catálogo ni ajustar stock desde esta vista.

El cambio conecta la vista con `inventory_items` y elimina el dataset simulado. La issue #48 se priorizó por decisión expresa del propietario, por delante del trabajo futuro FXP-045C y sin esperar R2.

## API y permisos

- `GET /api/v1/admin/inventory/items`: lista real de todos los artículos y clasificación derivada de `item_type`. Permiso `inventory.view`.
- `GET /api/v1/admin/inventory/items/{id}`: detalle autenticado de un registro real. Permiso `inventory.view`.
- `PATCH /api/v1/admin/inventory/items/{id}`: edita **solo** título, descripción, marca y modelo. Permiso `catalog.manage`. No permite alterar existencias, SKU, destino, costos ni visibilidad por esta ruta. Auditoría por cambios.
- `GET /api/v1/admin/inventory/items/{id}/adjustments`: últimos 50 movimientos manuales registrados. Permiso `inventory.view`.
- `POST /api/v1/admin/inventory/items/{id}/adjustments`: ajusta existencias por variación **entera con signo** y motivo de al menos 10 caracteres. Permiso `inventory.adjust`. Acepta `request_id` UUID para prevenir duplicados si el navegador reintenta una solicitud.

### Seguridad del stock

1. `inventory_stock_adjustments` registra `quantity_before`, `quantity_delta`, `quantity_after`, `reason`, usuario y fecha; también se escribe `inventory.stock_adjusted` en `audit_events`.
2. Se bloquea la fila del artículo (`FOR UPDATE`) y se rechaza saldo negativo o exceder el entero permitido.
3. La solicitud repetida con el mismo UUID y los mismos datos devuelve el resultado sin duplicar movimientos.
4. Los ajustes manuales **solo aplican a** `spare_part`, `accessory` y `service_part`. **Nunca** a `used_phone` o `device`: los teléfonos físicos requieren el proceso de ventas o extracción con ledger específico.
5. Los nuevos movimientos no se confunden con ventas reales ni con costos financieros; están identificados explícitamente como **ajustes manuales**, y servirán de fuente verificable para el futuro Dashboard #50.

## UI

- Acciones con iconos compactos y nombres accesibles: ver detalle, editar catálogo (si tiene permiso), ajustar stock (si está permitido), historial (cualquier usuario con `inventory.view`).
- Se preservan las funciones de búsqueda, filtros y paginación de la tabla; un refresco tras editar mantiene la tabla montada.
- Se utilizan cuadros de diálogo nativos, validación inline, errores legibles y confirmación explícita antes de cada ajuste. La estandarización global de modales seguirá en la issue #46.
- La salud del inventario distingue **agostado** (stock 0), **en stock sin mínimo** (no hay regla fiable), **reponer pronto** (stock menor o igual al mínimo realmente guardado en `metadata.reorder_point`) y **saludable** (supera el mínimo). No se inventan puntos de reposición: `NULL` significa sin configurar.
- La edición de la fila no gestiona el cambio de precio, publicación, stock ni operación de ventas. Esas reglas tienen sus propios permisos y casos de uso.

## Smoke y pruebas

- Una base vacía da 0 resultados reales, nunca ejemplos.
- Crear un repuesto y comprobar que aparece en la tabla con su SKU y cantidad.
- Sin sesión: 401; operador de ingreso: solo lectura; `catalog.manage`: edición descriptiva; `inventory.adjust`: ajuste manual y auditoría.
- Al ajustar `-2`, confirmar cantidad antes/variación/después y la razón; repetir la petición con mismo UUID y comprobar que no duplica el movimiento.
- Rechazar ajuste negativo superior al stock; denegar ajuste sobre teléfono físico.
- Confirmar que la vista conserva filtros y acceso a movimientos.
- Ejecutar tests Laravel, typecheck y build de React antes del merge.
- Smoke real tras despliegue y migraciones. No sembrar inventario ficticio en producción.

## Siguientes bloques según prioridad del propietario

`#50 → #54 → #55 → #47 → #46 → #49 → #51 → #52 → #53`.

La continuación de FXP-045C/045D/045E queda pausada hasta nueva instrucción.
