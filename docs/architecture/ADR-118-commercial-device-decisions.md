# ADR-118 · Motor de decisiones comerciales para dispositivos

- Estado: **Propuesto**, fase A de la issue #118
- Fecha: 2026-10-16
- Alcance: FixPhone, sin modificaciones al dominio de venta ni al inventario operativo
- No implica autorización de merge ni despliegue

## Contexto verificado (rama main al 2026-10-16)

Se inspeccionaron `composer.json`, `routes/api.php`, `DeviceValuationController`, `DeviceRoutingController`, `DeviceDismantlingController` y `DeviceSalesController`.

* Laravel 13 / PHP 8.3 / PHPUnit 12.
* `DeviceValuationController` mantiene `device_valuations` con `estimated_min_minor`, `estimated_max_minor`, `asking_price_minor`, `minimum_price_minor`, `market_reference` y publicación. Su validación de publicación pública exige dispositivo con `inventory_purpose=parts_donor`, procedencia, descripción, foto y stock. **No reutilizar esa publicación para venta directa de teléfonos completos** ni ampliar su semántica silenciosamente.
* `DeviceRoutingController` conoce destinos `Direct Sale`, `Refurbish`, `Donor`, `Hold`, `Discard` y `Pending Evaluation`. Bloquea operaciones ante ventas, pedidos abiertos, publicaciones y despieces iniciados; conserva vínculo de consignación y no altera ventas ni stock.
* `DeviceDismantlingController` actualiza estados de despiece; la extracción real tiene un flujo independiente.
* `DeviceSalesController` registra ventas reales mediante `device_sale_records` con `request_id` idempotente, `effective_sale_price_minor`, costo inicial, costo de repuestos instalados, consignante, moneda y anulación.
* Rutas existentes: `/admin/devices/{id}/technical-evaluations`, `/admin/inventory/{id}/routing`, `/admin/inventory/{id}/dismantling`, `/admin/devices/{id}/components`, `/admin/devices/{id}/sell` y `/admin/valuations`. Permisos distintos según operación.

Estos hallazgos **no** sustituyen la revisión pendiente de migraciones, servicios de precios, controlador de extracción, modelos, UI y pruebas.

## Decisión de arquitectura propuesta

Agregar un contexto separado **CommercialDecision** (nombre a validar con convenciones existentes), dependiente por lectura de inventario, evaluaciones técnicas, precios, repuestos y ventas, nunca dueño de sus transacciones.

**No reutilizar `device_valuations` como tabla de simulaciones:** su propósito actual es la publicación de teléfonos para piezas y hay unicidad por `inventory_item_id`. Una valoración comercial necesita versiones inmutables y 3 escenarios por ejecución.

Diseñar persistencia independiente (nombres tentativos, sujetos a auditoría de migraciones):
- `device_commercial_assessments`: ULID, inventory_item_id, actor, fecha, moneda, fecha/fuente de referencia, snapshot de insumos y versión de algoritmo; selección administrativa opcional.
- `device_commercial_scenarios`: assessment_id, opción `sell_as_is|refurbish|dismantle`, entradas, salidas calculadas, certidumbre, razón y plazo estimado.

Los snapshots nunca cambian movimientos de inventario ni precios de venta reales. El precio publicado pertenece al flujo específico de publicaciones que se confirme en la fase E; la venta efectiva sigue en `device_sale_records`.

## Fórmulas y garantías

- Venta tal cual: ingreso esperado basado en referencia comparable menos devaluaciones **no solapadas** y ajustes motivados.
- Reacondicionamiento: ingreso posterior a reparación menos adquisición, costos registrados de insumos y costos prospectivos explícitos, mano de obra y gastos. Mostrar aparte desembolso incremental de caja; un repuesto ya adquirido no puede contar dos veces como egreso contable.
- Despiece: valor recuperable ajustado por probabilidad/plazo de venta y costos de extracción/comercialización. No equiparar piezas aún no vendidas a ingresos realizados.
- `profit = net_realization - acquisition_cost - applicable_other_costs`; `margin = profit / gross_sales` si ventas > 0. Detallar convenciones de impuestos/comisiones y mantener moneda consistente.
- Si falta valor de mercado, diagnóstico o evidencia, mostrar **datos insuficientes** y no fingir precisión. Los bloqueos de cuenta, procedencia dudosa o condiciones críticas impiden recomendación de venta como plenamente funcional.
- Motor determinista y testeable. Recomienda con criterios explícitos de beneficio, riesgo, inversión de caja y plazo; no ejecuta cambios operativos.
- Decisión humana explícita, trazable y posterior a la simulación; las operaciones reales utilizan exclusivamente servicios existentes con sus controles transaccionales.

## API propuesta (no implementada)

- `POST /api/v1/admin/devices/{id}/commercial-assessments/preview`: cálculo sin escritura; entradas con validación estricta y respuesta explicable.
- `POST /api/v1/admin/devices/{id}/commercial-assessments`: snapshot de una simulación validada.
- `GET /api/v1/admin/devices/{id}/commercial-assessments`: historial.
- `GET /api/v1/admin/devices/{id}/commercial-assessments/{assessmentId}`: snapshot y escenarios.

Autorización inicial a revisar: `inventory.view` para consulta, permiso específico para guardar valoraciones; **no inferir que `valuation.manage` de ValuPhone cubre decisiones comerciales**. Ninguna API de simulación acepta órdenes para alterar stock/ventas. Registrar eventos de auditoría en persistencias/decisiones.

## UI propuesta

Acción `Comparar opciones` desde ficha de inventario; modal compacto:
1. Estado, defectos, procedencia y referencia de mercado (fecha/fuente);
2. Tres escenarios con beneficio, margen, caja incremental, plazo, confianza;
3. Razones de recomendación y advertencias;
4. Guardar valoración y, por separado, confirmar destino/precio mediante flujos ya existentes.

## Siguiente auditoría obligatoria antes de escribir código funcional

Revisar esquemas de `inventory_items`, `device_valuations`, `device_sale_records`, costos de repuestos, evaluaciones técnicas, extracción y publicaciones de dispositivos completos. Identificar la pantalla exacta de inventario, permisos y pruebas existentes. Determinar qué precios de referencia de reparación pueden ayudar como costo, **sin confundirlos con precio de reventa**. Luego fijar migraciones/API y casos de pruebas de integración.

## Pruebas de aceptación futuras

1. Mismo dispositivo: alternativas y diferencias justificables sin efectos en DB operativa durante preview.
2. Descuento conjunto sin doble contabilización.
3. Repuestos propios instalados desde stock: costo registrado cero y descuento de inventario en el flujo de instalación. La simulación lee ese cero sin revalorizarlo. Un costo de oportunidad hipotético, si se introduce, debe identificarse como tal y no cambia la contabilidad.
4. Consignado: no convertir en propiedad ni aplicar sin revisar reglas de liquidación.
5. Venta, pedido abierto o despiece iniciado: impedir acciones incompatibles; valorar historial de modo de solo lectura.
6. Versión de valoración recuperable, con moneda, fuentes, actor y fecha.
7. Precio real de venta inalterado por simulaciones.
8. Autorización 401/403, validaciones 422, pruebas unitarias/integración/UI y CI.

## Restricciones

No modificar eFactura, BellaHavana ni DeviceSpecsAPI; no ejecutar migraciones productivas, merges, deployments ni borrados. Mantener pequeños los PRs y exigir aprobación expresa para integrar.

## Estado revisado · 2026-10-16

- #120 contiene el calculador puro; los importes son hipótesis explícitas, no tarifas de mercado.
- #122 define `CommercialInputSnapshot` como contrato en Application y `DatabaseCommercialInputSnapshot` como adaptador en Infrastructure, registrado en el contenedor. Las lecturas se serializan con los escritores mediante el bloqueo de la unidad de inventario dentro de una transacción breve.
- El snapshot suma únicamente instalaciones activas y exige moneda consistente. No estima ni vuelve a cargar el costo de repuestos propios registrados con costo cero.
- #123 distingue costos históricos ya registrados de intervenciones prospectivas para impedir doble cómputo. Las consignaciones sin reglas verificadas devuelven datos insuficientes, sin ganancias de propiedad propia.
- #124 expone `POST /api/v1/admin/devices/{id}/commercial-preview`, con Sanctum, `inventory.view`, límite de frecuencia y respuesta no almacenable. Esta ruta sustituye el nombre de preview tentativo de este ADR.
- El resultado sigue siendo comparación manual sin recomendación (`recommended_kind=null`). No hay interfaz, persistencia de valoraciones ni recomendaciones automáticas en estas PR.
- Guardar valoraciones, conectar referencias verificables y construir la UI son fases posteriores, fuera de esta limpieza. Ninguna simulación vende, publica, extrae ni ajusta existencias.

Orden del bloque: revisar este ADR; integrar #120, #122, #123 y #124 respetando las bases apiladas. La limpieza de PR no autoriza merges ni despliegues.
