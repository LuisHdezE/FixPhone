# Mercado Pago Checkout Pro en FixPhone

## Estado y alcance

La integración usa el SDK PHP oficial `mercadopago/dx-php` y la API de Preferencias de Checkout Pro. El único CTA está en el carrito. El backend crea la orden desde el carrito persistido, genera la preferencia server-side y redirige únicamente al `init_point` productivo validado.

No se guardan importes, productos ni identidades enviados por el navegador. El retorno del navegador es informativo: nunca aprueba una venta. La confirmación llega por webhook y siempre se reconcilia contra Payment y Merchant Order de Mercado Pago.

La implementación queda desactivada por defecto. No se ejecutaron preferencias, pagos, webhooks ni pruebas productivas durante el desarrollo.

## Configuración

Completar en el `.env` de producción sin versionar valores secretos:

```dotenv
MERCADOPAGO_ENABLED=false
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
MERCADOPAGO_APPLICATION_ID=
MERCADOPAGO_COLLECTOR_ID=
MERCADOPAGO_INTEGRATOR_ID=
MERCADOPAGO_PUBLIC_URL=https://fixphone.eliasworks.uy
MERCADOPAGO_SITE_ID=MLU
MERCADOPAGO_CURRENCY=UYU
```

Validar sin imprimir secretos:

```bash
php artisan config:clear
php artisan mercadopago:check-config
```

El comando solo informa estado, Application ID, URL pública, sitio y moneda. Mantener `MERCADOPAGO_ENABLED=false` hasta que todos los demás valores estén cargados; luego activarlo y ejecutar `php artisan config:cache`.

## Flujo e invariantes

- La orden interna usa `external_reference=FPSTORE-{ULID}`, UYU y líneas persistidas.
- La reserva lógica dura 30 minutos y no descuenta stock.
- La preferencia valida Application ID, collector, referencia, moneda, total y host HTTPS oficial antes de persistirse.
- Una creación de preferencia incierta se reconcilia por `external_reference`; no se reintenta ciegamente un POST sin idempotencia documentada.
- El webhook valida HMAC con el validador del SDK, persiste el evento y responde rápido.
- El procesador consulta Payment y Merchant Order, y valida pago, aplicación, vendedor, preferencia, referencia, moneda, importe y relación entre recursos.
- La transacción bloquea orden e inventario. Cada venta genera un único ajuste de stock por orden y artículo.
- Pagos duplicados, contracargos, mediaciones, reembolsos y pagos tardíos sin stock pasan a revisión manual; nunca reponen ni descuentan stock automáticamente una segunda vez.
- Eventos anteriores a la última actualización del pago se ignoran.

## Webhook y cron en cPanel

URL productiva:

```text
https://fixphone.eliasworks.uy/api/v1/store/payment/mercadopago/webhook?source_news=webhooks
```

Configurar en cPanel un cron cada minuto, sustituyendo `USUARIO` y la ruta real:

```cron
* * * * * /usr/local/bin/php /home/USUARIO/fixphone/artisan schedule:run >> /home/USUARIO/fixphone/storage/logs/scheduler.log 2>&1
```

El scheduler ejecuta `mercadopago:process-notifications`, recupera trabajos abandonados, aplica reintentos con espera incremental, vence reservas y reconcilia órdenes abiertas. Para una ejecución manual:

```bash
php artisan mercadopago:process-notifications --limit=50 --reconcile=25
```

## Despliegue y recuperación

1. Respaldar base de datos y `.env`.
2. Publicar el código sin cambiar `MERCADOPAGO_ENABLED=false`.
3. Ejecutar `composer install --no-dev --optimize-autoloader`.
4. Ejecutar `php artisan migrate --force`.
5. Completar configuración, ejecutar `php artisan mercadopago:check-config` y configurar el cron.
6. Activar Mercado Pago, ejecutar `php artisan config:cache` y verificar el endpoint y el worker.

Para detener cobros, establecer inmediatamente `MERCADOPAGO_ENABLED=false` y regenerar la caché. Si hay pagos ya iniciados, conservar las tablas nuevas y mantener el cron activo hasta conciliarlos; no revertir la migración con transacciones pendientes. El rollback de código puede hacerse conservando el esquema, que es compatible hacia atrás.

## Prueba productiva pendiente

La prueba real requiere aprobación separada. Usará el SKU `REP-0042`, una compra mínima controlada, verificación de redirección, webhook, conciliación, estado final y un único ajuste de stock. No debe iniciarse desde herramientas automáticas ni con el vendedor comprándose a sí mismo.
