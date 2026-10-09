# FIXPHONE-REPAIR-QUOTES-001 · Presupuestador de reparaciones

## Antecedente

Fuente entregada por el propietario: index.zip, contiene index/index.html, calculadora HTML independiente (22 mayo 2025). Se trasladó su lógica a React/TypeScript y Laravel para FixPhone, sin agregar scripts externos Bootstrap/Font Awesome.

## Modelo de trabajo

- Módulo administrativo **Operación → Presupuestos**, ruta `/admin/repair-quotes`.
- Seleccionar gama baja/media/alta; elegir uno o varios servicios; alterar tarifa dentro del presupuesto si corresponde.
- Añadir repuestos por nombre, costo unitario y cantidad.
- Cálculo: mano de obra + redondeo(repuestos a costo × 1,20) + cadetería − descuento.
- Cadetería inicial 130 UYU, descuento inicial 0; conservo valores al limpiar.
- Los presupuestos de reparación son **documentos de oferta/estimación**, no órdenes de reparación ni ventas ni modificaciones de inventario.
- Cliente, contacto y equipo opcionales; no se comparte el teléfono privado en el texto para enviar.
- Cada registro guarda el detalle y las tarifas aplicadas en MySQL (`repair_quotes`) con auditoría. Totales calculados en Laravel con enteros de centésimos de UYU.
- Registros históricos inmutables: se crea un nuevo presupuesto para reflejar cambios.
- Consulta inicial del historial limitada a los 200 presupuestos recientes.
- Copiar texto del presupuesto para contactar al cliente manualmente, no se envía automáticamente por WhatsApp ni Meta.

## Tarifas de origen

Baja: pantalla 1200, batería 800, puerto carga 800, flex 800, tapa hasta XR 1500.
Media: pantalla 1500, batería 1000, puerto carga **100**, flex 1500, tapa iPhone 11–13 1800.
Alta: pantalla 2000, batería 1500, puerto carga 1300, flex 1800, tapa iPhone 14+ 2300.
Repuestos: +20 %; cadetería: 130 UYU.

**Revisar con el propietario la tarifa de puerto de carga de gama media (100 UYU)** antes de uso comercial. Se preservó exactamente la cifra suministrada, sin corregir silenciosamente. Los IDs repetidos del HTML ya no se reutilizan.

## API y seguridad

- GET `/api/v1/admin/repair-quotes`
- POST `/api/v1/admin/repair-quotes`
- Requieren Sanctum `auth:sanctum` y `repair_quotes.manage`; privilegio definido solo para owner/administrator/sales_operator.
- No exponer precios internos o datos privados al showroom público.
- `repair_quotes` e información de clientes es de administración, con auditoría de creación.
- La autenticación web reutiliza la integración segura de PR #38.

## Dependencia entre PR

Esta PR de presupuestos está basada en la rama de PR #38 (ValuPhone y login API real). Revisión y merge de #38 primero, luego cambiar base de esta PR a main, volver a verificar CI y smoke antes de fusionar. No mezclar implementación de presupuestos con la PR de valuación.

## Gates de verificación

1. CI PHPUnit Feature: 401 invitado, 403 técnico sin permiso, 201 para autorizado, totales backend y auditoría.
2. CI TypeScript typecheck y build.
3. Prueba manual: seleccionar gama, agregar 2 servicios y 2 repuestos, sumar 20 %, cadetería 130, descuento, guardar, recargar, consultar historial y copiar texto.
4. Confirmar que no se actualice inventario ni se publiquen presupuestos en catálogo público.
5. Confirmar tarifa sospechosa antes de generar cotizaciones reales.
6. No merge ni despliegue sin aprobación.
