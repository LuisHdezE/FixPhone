# FP-MEDIA-002 · Subida directa R2 y galería ValuPhone

## Principios

- Los destinos no están hardcodeados. El backend usa el perfil `media_storage_profiles.is_selected` de **esta instalación**.
- R2 recibe los archivos directamente desde el navegador mediante un PUT temporal firmado. cPanel no almacena fotografías ni procesa los binarios.
- Sólo usuarios con `valuation.manage` pueden solicitar subidas para una valoración **ya guardada**. El perfil del proveedor es exclusivo del servidor y los secretos cifrados nunca regresan al navegador.
- El servidor comprueba por `HEAD` tamaño y Content-Type de R2 antes de confirmar la fotografía y registrarla como asociada a la valoración. Nada de esto publica automáticamente el equipo.
- La primera foto confirmada se propone como principal; puede elegirse otra desde ValuPhone. Se guarda cada foto con el **ID del perfil de origen** más su URL pública concreta para evitar cruces al cambiar de bucket.
- Las fotos confirmadas se incluyen en la galería pública sólo si la valoración supera los controles previos de publicación y stock positivo. Las fotos pendientes no salen en el catálogo.
- Las imágenes originales se re-encodan en el navegador a WebP (límite de lado 1600 px), lo que elimina EXIF, GPS y metadatos de cámara. Sólo JPEG, PNG y WebP de entrada. Max 20MB originales y 5MB archivo optimizado; hasta 8 por valoración.
- La URL pública `r2.dev` sigue siendo sólo para desarrollo y bajo tráfico, aunque el Laravel activo diga `production`. No usar el bucket para documentos privados.

## Configuración CORS que el propietario debe aplicar a R2

Cloudflare Dashboard → R2 Object Storage → **fixphone-imagenes** → Settings → CORS Policy → Add.

Registrar una política para el origen **exacto** (sin barra al final):

```json
[
  {
    "AllowedOrigins": ["https://fixphone.eliasworks.uy"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Importante: seguir el formato de la interfaz de Cloudflare si permite introducir reglas individualmente en lugar del JSON completo. **No usar `*` como origen para subidas desde la aplicación**. Cloudflare puede necesitar unos minutos para propagar CORS; una foto R2 `r2.dev` pública puede visualizarse sin permitir escrituras anónimas, porque el PUT usa una firma temporal.

## Recorrido manual

1. En Administración → Almacenamiento de imágenes, comprobar que el perfil tenga status **Preferido**, bucket y URL pública correctos.
2. Configurar CORS en el bucket. No cambiar DNS de eliasworks.uy.
3. Crear o editar una valoración **privada/borrador** existente en ValuPhone y guardarla. La galería sólo aparece cuando la valoración ya tiene un ID.
4. Elegir una foto real JPEG/PNG/WebP y subirla. El navegador la optimiza y solicita firma temporal, luego hace PUT directo a R2 y POST para confirmar.
5. La galería muestra miniatura y botón «Hacer principal»; el campo URL de foto real se rellena automáticamente con la URL confirmada. Al guardarlo como borrador no aparece en el showroom.
6. Abrir Administración → Almacenamiento de imágenes: el perfil debe pasar de «sin comprobar» a «verificado», **sólo después de una subida confirmada con HEAD 200 real**.
7. Vincular la valoración a una unidad auténtica de inventario `parts_donor` con stock positivo, procedencia legítima, precio y descripción honesta; autorizar la publicación y verificar `/store/for-parts/{id}`. Comprobar miniaturas y OG para Facebook.
8. Cambiar otra vez a borrador y verificar que el listado público no la muestre.

## Endpoints

Requieren `auth:sanctum` + `valuation.manage`:

- `GET /api/v1/admin/valuations/{id}/photos` fotos confirmadas
- `POST /api/v1/admin/valuations/{id}/photos/presign` valida MIME/tamaño, crea reserva y devuelve PUT firmado, TTL 180s; throttle 10/min
- `POST /api/v1/admin/valuations/{id}/photos/{photoId}/confirm` verifica HEAD con datos R2 persistidos
- `POST /api/v1/admin/valuations/{id}/photos/{photoId}/primary` asigna imagen principal confirmada

## Riesgos/deudas pendientes

- R2 no ofrece una verificación previa en este bloque; la conexión queda confirmada únicamente tras la primera foto real.
- No existen aún eliminar fotografías, compactación automática en background ni un recolector de objetos huérfanos tras cargas abandonadas. Las reservas pendientes caducan y dejan de contar para el límite, pero una carga PUT completada sin confirmar puede dejar un objeto en el bucket; hace falta limpieza periódica en FP-MEDIA-003.
- El límite de tamaño inicial se valida al solicitar firma y al confirmar con HEAD. Una URL PUT firmada temporal podría enviar un binario mayor de lo declarado; el servidor **no confirmará** tamaños diferentes, pero puede consumir almacenamiento hasta que se recoja el objeto. Evaluar políticas POST con content-length-range o mecanismo adicional de control de cuota para producciones de clientes.
- No se ejecutan pruebas de credenciales reales en CI; se usa `Http::fake`. Una subida real es obligatoria antes de campañas.
- Cambiar perfil de almacenamiento no mueve archivos antiguos; se mantiene referencia a origen. No revocar antiguos dominios públicos hasta migrar.
- La publicación sigue permitiendo una URL HTTPS externa anterior por compatibilidad; se aconseja foto R2 verificada.
- Requiere HTTPS, política de permisos mínimos R2, almacenamiento sólo comercial y vigilancia de gastos.
