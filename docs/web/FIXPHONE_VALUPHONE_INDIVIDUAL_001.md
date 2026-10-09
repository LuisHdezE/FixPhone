# FIXPHONE-VALUATION-001 · ValuPhone en administración

## Objetivo comercial

Valuar y publicar un equipo por vez para atraer consultas y seguidores a FixPhone. No existe flujo de venta por lotes en este módulo. Las valoraciones son registros internos, no publicaciones automáticas en la tienda.

## Alcance implementado

- Menú Comercial → ValuPhone · Tasaciones, ruta /admin/valuations.
- Ficha individual editable con modelo libre (sugerencias iPhone 6–17), falla, pantalla, encendido, precios estimados y precios de publicación en UYU.
- Asociación opcional mediante inventory_item_id a inventario real. No crea, clona ni modifica automáticamente inventario.
- Estados propios del anuncio: borrador, publicado o cerrado. Cerrar un anuncio no registra una venta.
- Texto editable para Facebook con advertencia de bloqueo y CTA para seguir FixPhone; copiar manualmente. No publica automáticamente en Meta.
- Referencias iniciales solo para algunos iPhone 7–12 bloqueados por iCloud con pantalla buena. Son estimaciones orientativas, NO precios de Marketplace verificadas en vivo.
- Persistencia en device_valuations mediante API Laravel y auditoría en audit_events.
- Autenticación API /api/v1/auth/login (Sanctum); permiso valuation.manage para owner, administrator y sales_operator.
- Token web en sessionStorage, con cierre de sesión por endpoint; evaluar una sesión HttpOnly y CSP reforzada antes de producción abierta.

## Endpoints con Bearer y valuation.manage

- GET /api/v1/admin/valuations
- POST /api/v1/admin/valuations
- PATCH /api/v1/admin/valuations/{id}

JSON con data. Importes enteros en centésimos de UYU.

## Gates de aceptación

1. Migración desde cero y base anterior, sin destruir datos.
2. PHP Feature Tests: invitado 401, sin permiso 403, creación/listado/edición, precios 422 y auditoría.
3. Frontend typecheck y build.
4. Smoke manual: inicio de sesión con cuenta de propietario, ficha iPhone 11 iCloud, generar texto, guardar, recargar, editar y copiar; repetir con iPhone 14 Pro Max sin rango prefijado.
5. Comprobar que no publica en showroom ni cambia el stock.
6. No merge ni despliegue sin autorización y CI verde.

## Pendientes

- Integración más estrecha con evaluación técnica y catálogo maestro de modelos.
- Precios de referencia desde anuncios contrastados y fechados.
- Fotos reales, historial de revisiones y métricas de captación.
- Meta API, solo tras evaluar permisos y condiciones comerciales.

## Seguridad

Nunca incluir contraseñas, IMEI completos ni datos de la cuenta iCloud en anuncios. Publicar solo equipos con procedencia legítima, aclarando que son para repuestos y sin prometer desbloqueos.
