# Storefront: diseño aprobado y carrusel

Fecha: 2026-10-17. Base de implementación: origin/main, 3e21df7.

## Resultado

La portada /store combina la base blanca de la propuesta 1 con el carrusel rojo de la propuesta 3. Incluye navegación compacta, búsqueda conectada al listado mediante q, categorías fotográficas, tarjetas con imágenes sin recortes, precios del inventario publicado, acceso a equipos para repuestos y WhatsApp comercial.

Los anuncios iniciales promocionan celulares, reparación y repuestos. La portada usa todo el catálogo publicado para seleccionar celulares destacados, sin quedar limitada a las primeras ocho filas. Mientras se carga inventario no se muestran productos demo. Las imágenes promocionales son ilustrativas generadas con IA; las fotos, condición, precio y disponibilidad de cada producto siguen viniendo del inventario. Las categorías no prueban disponibilidad.

No se agregan acciones de carrito simuladas en las tarjetas: el botón abre el detalle comercial existente.

## Carrusel administrable

Administración → Carrusel de la tienda, ruta /admin/settings/store-campaigns.

Permite editar imagen, texto alternativo, encuadre, antetítulo, título, descripción, texto y enlace del botón. Permite agregar, quitar y ordenar hasta 8 anuncios. Guardar sin anuncios oculta el carrusel. Antes del primer guardado se usan anuncios incluidos en el frontend.

Se aceptan imágenes públicas HTTPS (incluidas URLs completas del almacenamiento R2 configurado) o archivos estáticos de /assets y /images. No hay credenciales ni hostname de R2 fijados en código. Este editor referencia imágenes existentes; no agrega un flujo de subida.

- GET /api/v1/store/campaigns: lectura pública de la configuración guardada.
- GET /api/v1/admin/store/campaigns: lectura administrativa.
- PUT /api/v1/admin/store/campaigns: reemplazo validado del conjunto ordenado.
- Las rutas administrativas requieren sesión y permiso catalog.manage.
- Tabla storefront_campaigns: registro único id=1 con JSON y timestamps.
- Botones de campaña restringidos a rutas /store; texto renderizado por React.
- Guardado inválido conserva el conjunto anterior.
- Una falla de carga administrativa bloquea el formulario para evitar sobrescribir datos con un conjunto vacío.
- Una falla al consultar campañas públicas mantiene los anuncios incluidos en el frontend.

La reproducción es opcional. Flechas, indicadores y teclas izquierda/derecha permiten avanzar. Reproducción se pausa con hover/foco y respeta prefers-reduced-motion.

## Validación

- npm.cmd run check: typecheck, build y 22 pruebas aprobadas.
- php artisan test en entorno testing con SQLite en memoria: 274 aprobadas, 2 omitidas, 1894 aserciones.
- 4 pruebas nuevas del API: permisos, orden/persistencia, conjunto vacío, validación de URLs y payloads, rechazo de duplicados y máximo de anuncios.
- 2 pruebas nuevas de render SSR: estructura accesible del carrusel (0, 1 y varias diapositivas), inventario real, precios y estado vacío.
- Render SSR adicional con las respuestas públicas de producción completado.
- git diff --check sin errores.
- Vite mantiene un aviso de tamaño de bundle y el runner SSR informa un puerto HMR ocupado; ambos comandos terminaron correctamente.
- La revisión visual interactiva a anchos de escritorio y móvil queda pendiente: el navegador disponible no puede acceder al servidor local de esta sesión. Los breakpoints se implementaron en CSS pero no se presentan como verificados visualmente.

## Publicación y reversión

La PR no despliega. El workflow existente de main despliega por FTP y ejecuta migraciones al integrar. Antes de autorizar merge deben revisarse los cambios de esta PR y su HEAD.

Después del despliegue: comprobar /store en escritorio y móvil; flechas/indicadores y reproducción; enlaces de categorías y búsqueda; editor administrativo y guardado de campañas; WhatsApp real.

Revertir el commit de la PR restaura las vistas previas. La tabla de campañas puede permanecer sin afectar inventario ni ventas; no requiere rollback destructivo.

Los cambios locales previos de inventario en G:\Desarrollo\FixPhone se conservaron. Esta implementación usa un worktree independiente.
