# Limpieza inicial de dispositivos en producción

Operación única: `fixphone-device-reset-2026-10-15`.

## Objetivo y alcance

Retirar los dispositivos de prueba antes de cargar equipos reales. Se borran físicamente los registros de `inventory_items` de tipo `device` y `used_phone`, incluidos los eliminados lógicamente. Se mantienen las tablas y las migraciones.

Se eliminan exclusivamente sus ventas, repuestos instalados, ajustes de stock, evaluaciones y comprobaciones técnicas, valoraciones vinculadas y metadatos de sus fotos. Se eliminan pedidos vinculados solo cuando todas sus líneas pertenecen a los dispositivos retirados. Un pedido mixto con repuestos/accesorios bloquea toda la operación para revisión.

Se conservan repuestos/accesorios independientes, catálogo maestro, usuarios/permisos, clientes, consignantes, presupuestos, precios de referencia/importaciones, prompts, configuración R2, auditoría de seguridad, registros de idempotencia y secuencia FXP. Los códigos FXP anteriores no se reutilizan. Las valoraciones sin dispositivo vinculado se conservan. Los archivos físicos en R2 no se borran.

## Ejecución desde GitHub

1. Integrar esta PR con aprobación del propietario y esperar que el despliegue cPanel termine correctamente.
2. En Actions, ejecutar **One-time production device reset**, rama **main**, modo **preview**.
3. Revisar `delete_counts`. La vista previa no borra registros.
4. Ejecutar el mismo workflow en modo **execute**, copiando el `fingerprint` exacto de la vista previa y la confirmación `BORRAR DISPOSITIVOS FIXPHONE PRODUCCION`.
5. Verificar `remaining_devices: 0`, `backup_verified: true` y los recuentos. Comprobar Dispositivos, ventas y dashboard en la aplicación.
6. Si se pierde la respuesta o vence el timeout, no reintentar a ciegas: revisar auditoría y estado de producción. El marcador transaccional impide repetir una limpieza completada.

El merge/despliegue por sí solo **no borra datos**. El workflow es exclusivamente manual y comparte exclusión con el despliegue. Evitar operar en el admin durante preview/execute; cualquier cambio en los registros escaneados invalida la huella.

## Respaldo y recuperación

Antes de borrar, el servidor guarda los registros afectados en `storage/app/private/device-reset/*.enc`, fuera del directorio público, cifrados mediante Laravel Crypt y APP_KEY. Se comprueba la escritura, lectura y descifrado antes de efectuar cualquier DELETE. El respaldo incluye las filas originales, relaciones y metadatos de fotos; no se publica como artifact ni se imprime en Actions.

Conservar la APP_KEY vigente: es necesaria para descifrar el respaldo. El nombre del archivo queda en el resultado y en el evento de auditoría. Este respaldo cubre las filas eliminadas, no sustituye un backup completo de cPanel ni incluye los binarios R2.

Para recuperar: detener escrituras, copiar el archivo privado a un entorno seguro con la misma APP_KEY, descifrar con `Crypt::decryptString`, validar operación/huella, y reinsertar `tables` en transacción, en orden padre-hijo (inventory_items, orders, device_valuations, device_technical_evaluations y luego sus dependencias). Revisar colisiones de ID antes de importar. No restaurar por un endpoint público ni sobrescribir filas nuevas. La restauración requiere intervención administrativa; no se ejecuta automáticamente.

## Controles

Autenticación con DEPLOY_TOKEN; confirmación exacta; huella de datos; bloqueo de ejecución concurrente; transacción y claves foráneas activas; respaldo previo verificado; marcador de operación única en auditoría. No se usa TRUNCATE, DROP ni desactivación de claves foráneas.

Las pruebas cubren vista previa sin borrado, eliminación física incluyendo soft deletes, dependencias técnicas y ventas, conservación de repuestos/catálogo/secuencia, respaldo descifrable, rechazo de huella obsoleta, confirmación incorrecta y autenticación. CI ejecuta la suite PHP existente.
