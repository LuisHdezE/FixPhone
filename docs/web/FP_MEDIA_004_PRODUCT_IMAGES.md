# FP-MEDIA-004 · Imágenes de productos en R2

Las fichas de publicación de teléfonos y repuestos, incluida la extracción de componentes, permiten seleccionar una foto local. El navegador la convierte a WebP (hasta 2048 px y 2 MB), eliminando metadatos de cámara, y envía el archivo temporalmente a FixPhone. El servidor usa exclusivamente el perfil R2 seleccionado para escribir `store/products/<ULID>.webp`, verifica tamaño y tipo mediante HEAD y devuelve una URL pública. El archivo no se conserva en el hosting.

La subida de la foto no publica ni guarda una ficha. Hay que pulsar **Guardar** en el modal para asociar la URL al producto. La opción de pegar una URL HTTPS sigue disponible para imágenes ya publicadas. Las fichas existentes conservan sus URLs.

## Prueba en producción

1. En **Administración → Almacenamiento de imágenes**, seleccionar un perfil R2 con bucket, endpoint, URL pública y credenciales. Usar **Probar conexión**. Si la conexión del hosting con R2 falla, resolverla antes de intentar fotos.
2. Abrir la publicación de un teléfono o repuesto y seleccionar una imagen JPG, PNG o WebP. Esperar el mensaje de imagen subida, comprobar la miniatura y pulsar **Guardar**.
3. Abrir el producto en la tienda y comprobar que la foto carga desde la URL pública configurada. Verificar el mismo resultado en el carrito.
4. Probar una foto en la planilla de extracción antes de guardar las piezas, y confirmar que aparece en la publicación resultante.

El endpoint `POST /api/v1/admin/store/products/images` requiere `catalog.manage` y tiene un máximo de diez solicitudes por minuto. Rechaza SVG, archivos falsos o mayores de 2 MB tras optimización. No devuelve URL si falla PUT o HEAD y nunca envía credenciales ni URL firmada al navegador. El navegador no necesita una política CORS de R2 para esta ruta, porque la transferencia ocurre desde el servidor de FixPhone. Las fotos subidas a fichas que luego se cancelan permanecen como objetos huérfanos; su limpieza futura requiere una política explícita de retención.

Este cambio no crea una galería de varias fotos por producto ni mueve automáticamente imágenes antiguas a R2.
