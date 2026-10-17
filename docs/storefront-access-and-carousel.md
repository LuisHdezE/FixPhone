# Tienda pública, carrusel y cuentas de clientes

## Entrada y navegación

La raíz `/` abre `/store`. El panel conserva `/admin` y `/apps/inventory/dashboard`; las rutas desconocidas vuelven a la tienda. Una cuenta autenticada con permisos efectivos ve el icono Administración en la cabecera de la tienda. Una cuenta sin permisos administrativos no puede abrir el shell administrativo.

## Carrusel

En el sidebar: **Tienda online → Carrusel y anuncios** (`/admin/settings/store-campaigns`). Requiere `catalog.manage` en la API. Permite configurar entre cero y ocho anuncios, agregar/quitar y cambiar el orden. Cada anuncio tiene imagen, texto accesible, encuadre, antetítulo, título, descripción y botón/enlace interno. Las imágenes se pueden subir desde el editor o indicar mediante URL pública HTTPS o un recurso de la tienda. Se muestra una miniatura antes de guardar. Cero anuncios oculta el carrusel. Los cambios se ven al volver a abrir la tienda.

## Cuentas y carrito

La navegación y las consultas son públicas. El botón Agregar al carrito pide iniciar sesión cuando no hay una identidad verificada y devuelve al producto tras autenticarse. El cliente debe volver a pulsar Agregar al carrito; iniciar sesión no modifica el carrito automáticamente.

El registro público crea usuarios activos con contraseña cifrada y sin asignaciones de roles/permisos administrativos. Usa el login real de Sanctum, comprueba la sesión con `/api/v1/auth/me` y comparte la persistencia de sesión existente entre tienda y panel. Cerrar sesión revoca el token y limpia el almacenamiento local. No se almacenan contraseñas en el navegador.

El carrito se persiste por usuario en `storefront_cart_lines` con clave única usuario/producto. Sus cuatro endpoints bajo `/api/v1/store/cart` exigen autenticación. La API resuelve el usuario desde el token y los precios desde inventario; rechaza cantidades superiores al stock, productos no publicados/no vendibles/sin precio o sin condición funcional requerida. Las consultas reflejan los precios actuales y marcan cantidades no disponibles. Agregar al carrito no reserva ni descuenta stock. La interfaz separa subtotales por moneda y permite consultar la compra; esta entrega no implementa cobro ni confirmación de pedidos.

Las escrituras del catálogo maestro también requieren autenticación y `catalog.manage`; la lectura de nombres de marcas/modelos/categorías permanece pública.

## Publicación y comprobaciones

Aplicar las migraciones habituales (`php artisan migrate --force`); se agrega una tabla sin transformar inventario existente. El flujo de despliegue de cPanel ya ejecuta las migraciones.

Validar: raíz → tienda; visita anónima a producto → consulta disponible y Agregar pide sesión; registro/login válidos → vuelve al producto; carrito persiste al recargar y no aparece en otra cuenta; cuenta cliente sin acceso al panel; cuenta autorizada con icono Administración; edición de anuncios y orden reflejados al reabrir la tienda. Las pruebas automatizadas cubren permisos, registro, credenciales inválidas, aislamiento del carrito, precios autoritativos, stock y exclusiones del catálogo.

## Editor compacto y carga de imágenes

El editor muestra filas con miniatura, título y acciones; solo un anuncio se despliega para editar. La barra superior mantiene Agregar anuncio, Guardar y Ver tienda. Los campos se distribuyen en columnas con controles de 32 px. Al guardar, un campo obligatorio vacío abre el anuncio correspondiente.

En cada anuncio, **Subir imagen** acepta JPG, PNG o WebP de hasta 20 MB. El navegador convierte a WebP, elimina metadatos y limita el lado mayor a 2048 px sin ampliar originales pequeños; la imagen resultante debe pesar hasta 2 MB. La API valida contenido, tamaño y dimensiones, exige `catalog.manage` y limita la frecuencia de cargas.

`POST /api/v1/admin/store/campaigns/images` transfiere el archivo mediante el servidor al perfil R2 seleccionado. Reutiliza el firmador existente, conserva las credenciales en el backend y verifica tamaño/tipo con HEAD antes de devolver la URL pública. No necesita CORS entre el navegador y R2. Si no hay perfil completo seleccionado, el editor muestra un error y enlace a Almacenamiento multimedia. Una carga fallida conserva la URL anterior. La subida guarda el objeto en R2, pero **Guardar carrusel** sigue siendo necesario para publicarlo; no se borran automáticamente archivos anteriores o subidos a borradores.
