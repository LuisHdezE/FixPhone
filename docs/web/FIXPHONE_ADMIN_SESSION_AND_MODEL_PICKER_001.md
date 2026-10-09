# FixPhone · Corrección de sesión, menú y selección de modelos

## Motivo

La sesión administrativa del frontend se almacenaba exclusivamente en sessionStorage, independiente para cada pestaña. El checkbox "Recordarme" era visual y no afectaba al almacenamiento. Además, ValuPhone estaba ubicado al final del menú Comercial y la selección de modelos usaba datalist, cuyo desplegable puede mostrar solo unas pocas sugerencias a la vez.

## Cambios

- La sesión de una pestaña continúa siendo la opción predeterminada al dejar "Recordarme" sin marcar.
- Al marcar "Recordarme en este navegador (12 horas)" se almacena **solo el token** en localStorage con vencimiento absoluto a 12 h. No se almacenan correos ni contraseñas.
- API Bearer/Sanctum mantiene autoridad: un HTTP 401 limpia ambos almacenamientos; cerrar sesión también los limpia y solicita revocación en el servidor.
- Los accesos desde ValuPhone y Presupuestos conservan la ruta de origen durante el login y redirigen a esa pantalla después.
- ValuPhone aparece inmediatamente junto a Presupuestos en Operación, sin segundo enlace duplicado en Comercial.
- Selección de modelo mediante select nativo con todas las opciones de iPhone 6 hasta iPhone 17/Air, desplazable. "Otro modelo" permite escribir cualquier modelo futuro. El campo de inventario sigue mostrando solo equipos realmente dados de alta.

## Plan de prueba manual

1. Sin marcar Recordarme: acceder, abrir ValuPhone y Presupuestos desde el menú de la **misma pestaña**. Ninguna debe pedir otro login.
2. Abrir una pestaña nueva sin Recordarme: requerir login allí es esperado por diseño.
3. Acceder marcando Recordarme, abrir otra pestaña nueva de la misma instalación y entrar directamente a /admin/repair-quotes y /admin/valuations. Ambas deben permitir el acceso sin pedir otro login.
4. Desde una pestaña nueva, cerrar sesión. Abrir de nuevo la herramienta y confirmar que requiere iniciar sesión.
5. En ValuPhone, abrir el selector, recorrer modelos desde iPhone 6 hasta iPhone 17; probar iPhone 11 Pro Max y iPhone 16 Pro Max.
6. Seleccionar "Otro modelo", escribir un modelo nuevo y verificar que se conserva al guardar y volver a abrir la ficha.
7. Comprobar que la lista de "Equipos ya registrados" depende solo del inventario y no restringe los modelos.
8. No realizar cambios en la base de datos ni en los registros de presupuestos existentes durante este ajuste.

## Nota de seguridad

La persistencia opcional en localStorage comparte el token entre pestañas y aumenta la exposición ante scripts de terceros ejecutados en el mismo origen; la versión futura debería priorizar cookies Secure/HttpOnly/SameSite con protección CSRF y CSP estricta. Nunca exponer el token ni registrarlo en logs de producción.
