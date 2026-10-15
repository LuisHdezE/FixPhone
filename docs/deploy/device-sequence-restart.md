# Inicio real en FXP-0001

El propietario solicitó reiniciar explícitamente la numeración después de la limpieza inicial. La limpieza anterior conservó el contador y el siguiente equipo recibió FXP-0202.

La migración `2026_10_15_160000_restart_device_sequence_after_initial_cleanup` reinicia el siguiente número a 1 solo en una base que registra la limpieza inicial autorizada. Antes del despliegue, retirar desde Dispositivos el equipo de prueba FXP-0202. El borrado normal lo archiva; su registro y auditoría se conservan.

El reinicio exige cero dispositivos activos y que FXP-0001 no exista en ningún artículo, incluidos los archivados. Bloquea el contador durante la comprobación y escribe una marca de auditoría con el valor anterior. Solo puede aplicarse una vez. Si encuentra un dispositivo activo o un conflicto, la migración falla sin cambiar el contador; retirar el dispositivo de prueba y reejecutar la migración desde el despliegue habitual. No cargar equipos reales hasta verificar el despliegue correcto.

Los entornos sin la marca de limpieza inicial no se modifican. El rollback no retrocede el contador. El asignador comprueba también filas archivadas para evitar colisiones futuras con FXP-0202 u otros códigos preservados. No se elimina ningún dispositivo durante este reinicio.

Verificación: despliegue correcto; el siguiente equipo real debe recibir FXP-0001 y el posterior FXP-0002. La operación queda registrada como `fixphone-device-sequence-restart-2026-10-15` en `audit_events`.

La misma entrega compacta el alta/edición de dispositivos en un modal mediano, sin secciones colapsadas, con campos distribuidos en columnas desde 640 px y acciones Cancelar/Guardar. En pantallas estrechas o de poca altura se conserva scroll accesible. La confirmación de eliminación usa un diálogo del sistema con identidad del equipo, foco inicial en Cancelar y errores persistentes sin cerrar el diálogo.
