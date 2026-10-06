# FT-2 · FixPhone Web Client Integration

Estado: EN REVISIÓN

## Objetivo

Crear una MVP web navegable dentro de `LuisHdezE/FixPhone` reutilizando las vistas reales auditadas de WebBlueprint, sin copiar el Blueprint completo y sin conectar todavía la API.

## Frontera

- Backend Laravel/MySQL permanece en raíz.
- Cliente React + TypeScript + Vite vive en `web/`.
- Datos y gateways permanecen mock/JSON durante FT-2.
- No se cargan datos reales.
- Las vistas faltantes se muestran como deuda deshabilitada, no se implementan.

## Vistas integradas

- panel operativo;
- equipos;
- alta de equipo;
- evaluación;
- inventario;
- clientes;
- pedidos;
- master data de celulares/repuestos;
- tienda online;
- listado/product detail;
- carrito;
- favoritos;
- checkout;
- envíos;
- contacto;
- garantía pública;
- cuenta cliente;
- perfil/configuración;
- sign-in/reset/2FA.

## Deuda visible

- usuarios y roles UI;
- catálogo comercial admin;
- lotes;
- consignaciones;
- diagnóstico;
- reparaciones;
- deshuesado;
- ubicaciones;
- conteos;
- gastos;
- liquidaciones;
- reclamos administrativos de garantía;
- rentabilidad;
- aging;
- integraciones;
- auditoría.

## Reutilización

Origen visual: `LuisHdezE/WebBlueprint@0199bdb221d9adc9ef19daeb141541634686d89a`

Solo se trasladaron módulos del manifiesto FT-1 y dependencias compartidas requeridas por esas vistas.

## CI

El workflow principal tiene jobs independientes:

- `backend`: Composer + PHPUnit/Laravel;
- `web`: Node 22 + instalación + typecheck + build.

## Gate FT-2

- [x] `web/` creado;
- [x] navegación FixPhone propia;
- [x] storefront separado del admin;
- [x] theme baseline azul;
- [x] deuda visible e inactiva;
- [x] CI web incorporada;
- [ ] backend CI verde;
- [ ] web CI verde;
- [ ] revisión visual posterior al build;
- [ ] aprobación humana de merge.

## Siguiente bloque

FT-3 · Visual MVP Review

Después del merge se revisará la MVP ejecutable, se corregirán defectos de ensamblaje/branding y solo entonces se planificará la vinculación progresiva con la API.
