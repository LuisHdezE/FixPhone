# Tienda pública, carrusel y cuentas de clientes

## Entrada y navegación

La raíz `/` abre `/store`. El panel conserva `/admin` y `/apps/inventory/dashboard`; las rutas desconocidas vuelven a la tienda. Una cuenta autenticada con permisos efectivos ve el icono Administración en la cabecera de la tienda. Una cuenta sin permisos administrativos no puede abrir el shell administrativo.

## Carrusel

En el sidebar: **Tienda online → Carrusel y anuncios** (`/admin/settings/store-campaigns`). Requiere `catalog.manage` en la API. Permite configurar entre cero y ocho anuncios, agregar/quitar y cambiar el orden. Cada anuncio tiene imagen, texto accesible, encuadre, antetítulo, título, descripción y botón/enlace interno. Las imágenes se indican mediante URL pública HTTPS o un recurso de la tienda. Se muestra una miniatura antes de guardar. Cero anuncios oculta el carrusel. Los cambios se ven al volver a abrir la tienda.

## Cuentas y carrito

La navegación y las consultas son públicas. El botón Agregar al carrito pide iniciar sesión cuando no hay una identidad verificada y devuelve al producto tras autenticarse. El cliente debe volver a pulsar Agregar al carrito; iniciar sesión no modifica el carrito automáticamente.

El registro público crea usuarios activos con contraseña cifrada y sin asignaciones de roles/permisos administrativos. Usa el login real de Sanctum, comprueba la sesión con `/api/v1/auth/me` y comparte la persistencia de sesión existente entre tienda y panel. Cerrar sesión revoca el token y limpia el almacenamiento local. No se almacenan contraseñas en el navegador.

El carrito se persiste por usuario en `storefront_cart_lines` con clave única usuario/producto. Sus cuatro endpoints bajo `/api/v1/store/cart` exigen autenticación. La API resuelve el usuario desde el token y los precios desde inventario; rechaza cantidades superiores al stock, productos no publicados/no vendibles/sin precio o sin condición funcional requerida. Las consultas reflejan los precios actuales y marcan cantidades no disponibles. Agregar al carrito no reserva ni descuenta stock. La interfaz separa subtotales por moneda y permite consultar la compra; esta entrega no implementa cobro ni confirmación de pedidos.

Las escrituras del catálogo maestro también requieren autenticación y `catalog.manage`; la lectura de nombres de marcas/modelos/categorías permanece pública.

## Publicación y comprobaciones

Aplicar las migraciones habituales (`php artisan migrate --force`); se agrega una tabla sin transformar inventario existente. El flujo de despliegue de cPanel ya ejecuta las migraciones.

Validar: raíz → tienda; visita anónima a producto → consulta disponible y Agregar pide sesión; registro/login válidos → vuelve al producto; carrito persiste al recargar y no aparece en otra cuenta; cuenta cliente sin acceso al panel; cuenta autorizada con icono Administración; edición de anuncios y orden reflejados al reabrir la tienda. Las pruebas automatizadas cubren permisos, registro, credenciales inválidas, aislamiento del carrito, precios autoritativos, stock y exclusiones del catálogo.
