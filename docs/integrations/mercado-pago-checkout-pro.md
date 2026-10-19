# Checkout de FixPhone: fase de orden interna

## Alcance de esta fase

El carrito envía una solicitud autenticada a FixPhone. El backend crea una orden interna a partir del carrito guardado y devuelve su identificador, referencia, total y estado.

Esta fase **no llama a Mercado Pago**, no crea preferencias, no redirige a Checkout Pro y no confirma pagos. Tampoco descuenta inventario.

## Datos autoritativos de la orden

El backend toma los productos, cantidades, precios, usuario y moneda desde las tablas de FixPhone. Ignora importes o productos enviados por el navegador. Cada línea guarda una copia del SKU, título, cantidad y precio unitario para preservar el contenido de la orden aunque el catálogo cambie.

La orden incluye:

- número interno de orden;
- referencia externa única `FPSTORE-{ULID}`, lista para relacionar la futura preferencia y el pago;
- email y nombre del cliente autenticado;
- moneda UYU y total en unidades menores;
- clave de idempotencia del intento de checkout;
- vencimiento de la reserva temporal de inventario.

El stock se reserva lógicamente durante 30 minutos. No se descuenta al registrar la orden. Los ajustes de inventario y los pedidos comerciales respetan esa reserva. Al vencerse, el checkout libera la reserva.

## Contrato para la fase de Mercado Pago

Cuando se autorice la integración con Checkout Pro, la preferencia deberá generarse server-side usando exclusivamente la orden persistida. La solicitud deberá incluir las líneas guardadas, `external_reference`, email del cliente, URLs de retorno y URL de notificaciones. El backend guardará el ID de preferencia y la URL de Checkout Pro después de recibir una respuesta válida del vendedor configurado.

El retorno del navegador nunca marcará una orden como pagada. La fase de notificaciones deberá consultar el pago desde el backend y validar estado, detalle, importe, moneda, vendedor, preferencia y referencia antes de confirmar la venta y descontar stock una sola vez.

Las credenciales productivas no forman parte de esta fase.
