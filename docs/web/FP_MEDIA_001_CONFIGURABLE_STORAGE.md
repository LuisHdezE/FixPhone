# FP-MEDIA-001 · Configuración de almacenamiento reutilizable

## Objetivo

Desacoplar el destino de fotografías de los repositorios y del código de la aplicación. La configuración pertenece a **cada instalación** de la app. En desarrollo, una instalación puede usar R2 del desarrollador. Al entregar el producto a un cliente, la instalación productiva registra otro perfil con su cuenta y su bucket. No se redistribuyen las credenciales de desarrollo.

## Panel administrativo

**Administración → Almacenamiento de imágenes** (`/admin/settings/media-storage`).

API administrativa con `auth:sanctum` + `integrations.manage`:
- GET `/api/v1/admin/media/storage-profiles`: sólo resúmenes, no credenciales.
- POST `/api/v1/admin/media/storage-profiles`: crear perfil.
- PATCH `/api/v1/admin/media/storage-profiles/{id}`: editar, claves vacías preservan las actuales.
- POST `/api/v1/admin/media/storage-profiles/{id}/select`: seleccionar uno, transaccional. Exige clave de acceso, secreto y URL pública configurados.

Un perfil almacena: nombre, proveedor (`r2` en esta primera versión), bucket, endpoint S3 de la cuenta (sin /bucket), URL pública HTTPS opcional, prefijo de objetos, credenciales cifradas y selección. La configuración está en MySQL, no en los assets frontend, GitHub ni `.env` por cliente. La infraestructura backend dispone del resolvedor `MediaStorageProfileResolver`, que descifra los valores exclusivamente en servidor.

### Seguridad y límites

- Las dos credenciales R2 se cifran mediante Laravel `Crypt::encryptString`, protegidas por `APP_KEY`; la aplicación requiere mantener una clave privada y consistente por instalación. **Nunca copiar APP_KEY o R2 secret desde desarrollo a la instalación del cliente**.
- Endpoint R2 restringido a `https://<account-id-hex>.r2.cloudflarestorage.com`, sin rutas, parámetros, puertos ni usuario/contraseña. Esto reduce riesgos SSRF en futuras conexiones.
- Respuestas y logs de auditoría no contienen secretos. El frontend utiliza inputs `password` que no repueblan la clave.
- Rol de gestión: `integrations.manage` (owner, administrator). Operadores de venta o taller reciben HTTP 403.
- CORS, bucket privado, permisos mínimos y límites de cargas deben configurarse durante la fase del adaptador de subida.
- Cambiar el perfil seleccionado **NO mueve ni borra** fotos guardadas en otro bucket.
- Los datos con keys de objeto deben conservar el identificador del perfil de origen; **no reinterpretar claves antiguas contra un bucket nuevo**.
- URL pública y endpoint S3 son distintos. `r2.dev` puede usarse temporalmente para pruebas con objetos públicos; no recomendado para campañas/producción.
- Antes de usar imágenes reales, deben existir consentimiento/procedencia y revisión de información en fotografías (IMEI, documentos, etc.).

## Estado del bloque

Esta PR crea exclusivamente **configuración**, no una integración de transferencia de fotos:
- No solicita ni prueba credenciales contra Cloudflare.
- No crea buckets ni habilita acceso público.
- No sube archivos ni emite URLs prefirmadas.
- No modifica ValuPhone, el catálogo ni las imágenes existentes.

La interfaz muestra de forma explícita `Conexión sin comprobar`; sólo guarda y selecciona perfiles configurados. El siguiente bloque FP-MEDIA-002 implementará un adaptador de subida R2 S3-compatible desde Laravel, permisos y políticas del bucket, URLs prefirmadas, validación de tipo/tamaño, metadatos y galería en ValuPhone. Su implementación deberá generar/comprobar los artefactos Composer (SDK/adapter y lock), mantener la separación por entorno y validar una subida real antes de habilitarla.

## QA automatizada

- 401 invitado, 403 rol sin permisos.
- Encriptación real con Laravel Crypt y no divulgación por GET/POST/audit.
- Rotación de secreto con PATCH; campos vacíos conservan secreto.
- Selección única de perfil; resolvedor disponible sólo backend.
- Perfil incompleto no seleccionable.
- Rechazo de endpoints R2 inválidos y URLs internas.

## Criterio de migración para el cliente

1. Instalar aplicación y configurar `APP_KEY` propia.
2. Crear perfil nuevo del almacenamiento del cliente con claves **scope bucket**.
3. Seleccionar nuevo perfil una vez verificada la configuración.
4. Migrar fotografías existentes si se requieren, mediante tarea explícita con registro del bucket de origen y destino, **nunca sólo cambiando la URL pública**.
5. Revocar accesos temporales del desarrollador antes de entregar.
