# FP-MEDIA-003 · Experiencia de carga de fotos y diagnóstico de R2

## Motivo

En la primera prueba real, ValuPhone mostró un input nativo de archivos poco visible y el error genérico **Failed to fetch**. El texto no permite deducir por sí solo si hubo un fallo al solicitar la firma a FixPhone, al contactar R2 por CORS/red o al confirmar el archivo.

## Cambios

- Botón visible **Agregar fotografías**, con selector JPG/PNG/WebP, contador, nombres seleccionados y mensajes por etapa.
- Errores diferenciados de (1) autorización API FixPhone, (2) transferencia R2, (3) verificación R2. No se registran ni muestran URL firmadas, tokens, headers Authorization ni claves.
- Reintento del archivo seleccionado cuando es razonablemente seguro. Si se envió al bucket pero falló la confirmación, no duplicar ciegamente: revisar primero la galería.
- Si falla la conexión del navegador con R2 (frecuentemente CORS/extensiones/red), se usa una **ruta de respaldo autenticada** `POST /api/v1/admin/valuations/{id}/photos/{photoId}/relay`. Usa la autorización de carga ya emitida, verifica `photoId`, asociación con valoración, tipo/tamaño reales y vigencia; sube por backend a R2 y confirma por HEAD. Límite 5 MB optimizados, throttle 10/min, sólo `valuation.manage`. Los binarios atraviesan temporalmente PHP/cPanel pero **no se guardan permanentemente allí**. Puede utilizar almacenamiento temporal durante la petición; respetar límites PHP de upload / post. Mínimo uso de relay, subida directa sigue como camino preferido.
- Botón **Probar conexión** en Administración → Almacenamiento de imágenes. Ejecuta HEAD firmado sobre un objeto aleatorio inexistente; un 404 de R2 indica que las credenciales de lectura y el endpoint son válidos. 403/401 indica permiso o firma incorrectos. No escribe archivos ni marca `verified_at`, reservado para subida real confirmada. Sólo `integrations.manage`, throttle 6/min.

## Prueba manual posterior al despliegue

1. En Administracion → Almacenamiento de imágenes, hacer clic **Probar conexión** del perfil `R2 FixPhone - Principal`.
2. Si responde satisfactoriamente, abrir una valoración ya guardada en ValuPhone (borrador).
3. Pulsar el botón **Agregar fotografías**, seleccionar una foto original del equipo; observar las etapas.
4. Si funciona, comprobar miniatura, enlace público, R2 Objects y estado *verificado* del perfil.
5. Si falla, copiar el nuevo mensaje específico (sin ningún URL firmado) para distinguir problemas de hosting/CORS/R2/permisos.
6. No publicar el equipo mientras no esté vinculado a inventario real y cumpla condiciones de venta.

## Invariantes

- Sin cambios en DNS ni necesidad de entrar en Cloudflare para reintroducir credenciales.
- Sin anuncios Facebook automáticos, inventario no se duplica.
- No hacer públicas fotos de una valoración en borrador.
- No exponer firma temporal en alertas, respuestas de error ni logs.
- El fallback no elimina la utilidad de CORS: sigue recomendado para subir sin pasar archivos por hosting.
