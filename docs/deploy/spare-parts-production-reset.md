# Limpieza inicial de repuestos y numeración REP

Primera fase solicitada por el propietario antes de la planilla de despiece.

## Alcance

Se eliminan físicamente todos los artículos de tipo `spare_part` (incluidos los archivados) y sus ajustes de stock. Se conservan teléfonos, accesorios, insumos, catálogo maestro, clientes, consignantes, configuración, auditoría y contador FXP.

La operación se detiene si hay repuestos vinculados a pedidos, ventas, instalaciones, valoraciones o evaluaciones técnicas. No elimina relaciones comerciales para forzar el borrado.

Los códigos anteriores de repuestos eran REP seguido de ULID; no existía un contador numérico. Esta entrega añade `inventory_spare_part_sequences` y asignación transaccional REP-0001, REP-0002, etc. Reiniciar en cero significa que el siguiente número a emitir es 1. No se reinician los ULID de la base de datos.

## Procedimiento

1. Integrar con autorización del propietario y esperar despliegue correcto. El despliegue no borra repuestos.
2. Actions → **One-time production spare parts reset**, rama main, modo preview.
3. Revisar delete_counts y preserved_items.
4. Ejecutar en modo execute con fingerprint exacto y confirmación **BORRAR REPUESTOS FIXPHONE PRODUCCION**.
5. Verificar remaining_spares=0, next_spare_code=REP-0001 y backup_verified=true. No reejecutar a ciegas tras un timeout.
6. Iniciar la nueva carga solo tras esta comprobación.

## Respaldo y seguridad

Antes del DELETE se guarda y verifica un respaldo cifrado con Laravel Crypt en `storage/app/private/spare-reset/*.enc`. Contiene las filas de repuestos, ajustes y el valor previo del contador REP. Requiere conservar APP_KEY para recuperar. No incluye archivos binarios ni se sube a Actions o GitHub.

Para recuperar, detener escrituras, descifrar en entorno seguro con APP_KEY y reinsertar inventory_items y luego inventory_stock_adjustments dentro de una transacción tras revisar colisiones. El contador debe quedar por encima del máximo código emitido desde el reinicio; no sobrescribirlo con el valor antiguo si ya existen nuevas altas.

Bloqueo de contador compartido con el alta, transacción, claves foráneas activas, autenticación DEPLOY_TOKEN, huella de datos, confirmación y marca de auditoría impiden ejecución concurrente o repetición posterior. Sin DROP/TRUNCATE ni borrado automático por migraciones.

## Siguiente fase: planilla de despiece

Sobre un equipo real destinado a despiece, seleccionar tipos de componente del catálogo (pantalla, puerto, cámaras, etc.). Cada selección ingresará una unidad para la marca/modelo del equipo, sumando al artículo compatible o creándolo. Debe conservar el vínculo con el donante, impedir repetir una extracción del mismo componente y registrar el movimiento.

La publicación requiere resolver precio, condición, prueba funcional e imagen: no inventar esos datos ni publicar automáticamente piezas no verificadas. La siguiente fase debe incluir la preparación/publicación de repuestos en showroom; esta entrega aún no implementa la planilla.
