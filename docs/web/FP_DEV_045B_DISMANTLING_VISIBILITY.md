# FXP-045B · Estados de despiece y control de publicación

## Resumen

Fase B de la [issue #45](https://github.com/LuisHdezE/FixPhone/issues/45). Se ejecuta sin esperar la recuperación TLS de Cloudflare R2. **No se extraen piezas ni modifican existencias en esta fase.**

## Modelo

- Fuente única: `inventory_items`. Se añade `dismantling_status` para dispositivos, **independiente** de `inventory_purpose` (destino), `operational_status` (situación operativa) y el control de publicación.
- Los dispositivos creados por la API después de esta fase reciben `not_started`. Los dispositivos históricos conservan `NULL`, representado en la UI como **Sin verificar**; no asumimos una revisión física ficticia.
- Transiciones permitidas: `unknown → not_started | partial | exhausted`; `not_started → partial | exhausted`; `partial → exhausted`; `exhausted` es terminal. La API no permite volver a afirmar «intacto» después de registrar despiece. La futura fase de correcciones auditables deberá habilitar rectificaciones controladas cuando existan errores humanos.
- Estado de despiece solo para equipos cuyo `inventory_purpose = parts_donor` y cuyo `item_type` es `device` o `used_phone`; no aplica a repuestos individuales.

## API y permisos

- `PATCH /api/v1/admin/inventory/{id}/dismantling` con `{"dismantling_status":"partial"}`, por ejemplo.
- Protegido por `auth:sanctum` y `workshop.dismantle`: propietario, administrador y técnico según la matriz actual. Ser operador de ingreso no habilita a declarar una extracción.
- Actualización bajo transacción y bloqueo de fila; registra `INVENTORY.DISMANTLING_STATUS_CHANGED` en auditoría con estado anterior/nuevo, actor y correlación.
- El estado `partial` o `exhausted` provoca la retirada **a borrador** de cualquier ficha pública ValuPhone publicada para ese equipo, con auditoría `VALUATION.UNPUBLISHED_DUE_TO_DISMANTLING`.
- La propia consulta pública `PublishedPartsDonor::query()` filtra equipos `partial` o `exhausted`, incluso si otro proceso modificara la base de datos fuera del endpoint. `DeviceValuationController` también prohíbe republicarlos.
- No se manipula `stock_quantity`, no se duplica inventario, y no se presume que una consulta WhatsApp genere reserva.

## Interfaz

- `/apps/inventory/devices`: columnas compactas **Despiece**, **Publicación** y **Acciones**. El listado conserva búsqueda, filtros, paginación y el identificador visible FXP.
- **Publicación** proviene del gate público existente de ValuPhone, no de un segundo interruptor de inventario. Muestra enlace individual únicamente si realmente es público. ValuPhone sigue siendo el lugar donde autorizar una publicación con fotografía real HTTPS, descripción, precio y procedencia.
- Solo personas con permiso `workshop.dismantle` ven el selector de transición. Una confirmación explícita advierte de despublicación y de que no habrá cambios automáticos de stock.
- ValuPhone incorpora el estado de despiece en su checklist antes de publicar.
- Se mantiene la ficha pública individual solo para equipos aún elegibles; equipos históricos `NULL` conservan la compatibilidad previa y no son declarados «intactos» de manera automática.

## Gates de verificación

1. Migraciones sobre base limpia y base existente; nuevas altas obtienen `not_started`, históricas quedan `NULL`.
2. Probar `PATCH` sin sesión (401), con operador de ingreso (403), con propietario (200).
3. Probar transiciones permitidas/rechazadas y validación de equipo no donante.
4. Un equipo publicado en ValuPhone y marcado `partial` desaparece del catálogo y de la ficha individual y su valoración queda en borrador, sin reducir stock.
5. Intento de republicación tras despiece debe dar 422; un registro publicado por error en BD debe quedar filtrado.
6. La consulta administrativa indica **Publicada** solo si el gate real la muestra.
7. Ejecutar Laravel Feature Tests, TypeScript typecheck y React build.
8. Smoke con equipo real en producción solo después del merge. Evitar registros artificiales y confirmaciones falsas de piezas extraídas.

## Fuera de alcance

- FXP-045C: showroom agrupado de equipos por modelo con WhatsApp.
- FXP-045D: movimientos de extracción por pieza y baja contable de inventario de forma trazable.
- FXP-045E: valorización de unidad frente a componentes y coste asociado.
- Las cuestiones de reversión/corrección retroactiva con auditoría deben definirse junto a la ledger de piezas, no habilitar ediciones silenciosas en este bloque.
