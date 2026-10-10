# FP-AUTH-002 · Sesión administrativa real y navegación coherente

## Causa del incidente

El usuario abría `/admin/settings/media-storage` y veía «Iniciá sesión…» aunque el marco con el menú administrativo seguía apareciendo. Antes de este cambio, `FixPhoneAdminShell` se montaba **sin comprobar autenticación**; ValuPhone, Presupuestos y Almacenamiento de imágenes hacían sus propias comprobaciones `Boolean(adminToken())`, independientes del shell.

La presencia de la barra lateral nunca equivalía a una sesión validada. El token se almacena en `sessionStorage` por defecto y únicamente en la pestaña que hizo login. Con la opción «Recordarme», está en `localStorage` por hasta 12 horas; es un comportamiento consciente de seguridad y no se cambia en este bloque.

## Corrección

- Todas las rutas dentro de `FixPhoneAdminShell` están envueltas en `AuthenticatedAdminShell`, que consulta la identidad verdadera a través de `GET /api/v1/auth/me` antes de mostrar el panel.
- Si no hay token o la API responde 401/usuario eliminado, se muestra la **página de inicio de sesión real**, conservando la ruta solicitada. No se muestra un panel aparentemente autenticado ni un segundo formulario dentro de una vista.
- Si falla la red o la API responde 5xx, se ofrece **Reintentar comprobación** sin destruir un token potencialmente válido.
- El menú de usuario muestra el nombre y correo que entregó la API. No se utiliza el `SessionProvider` simulado.
- Los eventos `fixphone:admin-session-changed` y `storage` permiten refrescar la validación después de logout, caducidad por 401 y cambios en «Recordarme» desde otra pestaña.
- Después de login se regresa a la sección administrativa solicitada, incluyendo rutas de inventario, panel y perfil.
- Las verificaciones específicas de permisos (por ejemplo, `integrations.manage` o `valuation.manage`) siguen en Laravel. Una sesión válida no equivale a tener permiso para cada recurso.

## Matriz de pruebas manuales

1. **Misma pestaña**: iniciar sesión sin marcar «Recordarme»; abrir ValuPhone y Almacenamiento desde el menú. La API `/auth/me` debe validar la sesión al entrar y no pedir contraseña otra vez.
2. **Pestaña nueva sin «Recordarme»**: abrir directamente una ruta administrativa; se requiere login por diseño. Ya no aparece el menú como si la sesión fuera válida. Tras login, se regresa a la ruta solicitada.
3. **Pestaña nueva con «Recordarme»**: acceder marcando la opción; abrir la ruta administrativa en otra pestaña del mismo navegador. Se reconoce el token compartido sin nuevo login, mientras esté vigente.
4. **Cierre de sesión**: pulsar Cerrar sesión; no debe quedar ninguna sección administrativa visible. Una navegación posterior requiere autenticación.
5. **Revocación HTTP 401**: si la API revoca el token, la siguiente petición protegida lo limpia y la interfaz deja de mostrar el panel.
6. **API temporalmente no disponible**: muestra mensaje de comprobación y botón reintentar; no borra token por un 500.
7. **Roles**: entrar con un usuario válido sin permiso `integrations.manage` y confirmar que la API devuelve 403 en Almacenamiento. No se interpreta como sesión vencida.

## Alcance y límites

No se modifica Laravel, las credenciales R2, la cuenta de Cloudflare, los DNS ni la política «Recordarme». No se promete acceso compartido entre pestañas cuando «Recordarme» no está marcado. Una futura migración a cookies HttpOnly puede cambiar esa decisión, pero requiere diseño de protección CSRF y pruebas de autenticación de extremo a extremo.

Automatización actual: `npm run check` (TypeScript + build), más CI existente de Laravel. No hay suite de pruebas de React e2e en este repositorio; la matriz anterior deberá probarse manualmente antes de dar el incidente por cerrado.
