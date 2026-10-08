# Guía de Despliegue en cPanel para FixPhone

Este documento describe cómo desplegar el proyecto FixPhone (Laravel API + React SPA) en un hosting compartido cPanel.

## 1. Crear .env en Producción
El archivo `.env` NO debe ser subido al repositorio bajo ningún concepto. Debes crearlo a mano en el cPanel (vía Administrador de Archivos o SSH) en la raíz del proyecto (`~/fixphone_app/.env`).

Contenido mínimo de producción:
```ini
APP_NAME=FixPhone
APP_ENV=production
APP_KEY=base64:TUKLAVEGENERADA=
APP_DEBUG=false
APP_URL=https://fixphone.uy

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=usuario_fixphone
DB_USERNAME=usuario_dbuser
DB_PASSWORD=tumuybuenapassword
```
*(Nota: Para generar un `APP_KEY` puedes correr `php artisan key:generate --show` localmente y copiar el valor).*

## 2. Crear DB MySQL en cPanel
1. Ve a **Bases de datos MySQL** en cPanel.
2. Crea una base de datos (ej. `usuario_fixphone`).
3. Crea un usuario (ej. `usuario_dbuser`) con contraseña segura.
4. Añade el usuario a la base de datos otorgando **todos los privilegios**.
5. Rellena las credenciales en el `.env` (Paso 1).

## 3. Construir React localmente (Opcional si no usas GitHub Actions)
Si vas a desplegar a mano sin GitHub Actions:
```bash
cd web
npm install
npm run build
```

## 4. Copiar React a Public
Luego del build, debes copiar TODO el contenido generado en `web/dist/*` y colocarlo dentro de la carpeta `public/` de Laravel.
Esto asegura que Laravel sirva tanto tu API como el `index.html` compilado.

## 5. Instalar Composer en Producción
Una vez subidos los archivos al cPanel, mediante SSH corre en la carpeta del proyecto:
```bash
composer install --no-dev --optimize-autoloader
```

## 6. Migraciones
Nunca ejecutes migraciones destructivas de forma automatizada en este MVP sin backup previo.
Para actualizar la DB, entra por SSH a cPanel y ejecuta:
```bash
php artisan migrate --force
```

## 7. Limpiar y Cachear Laravel
Luego de actualizar código o modificar el `.env`, siempre ejecuta:
```bash
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## 8. Qué carpetas NO subir a producción
Al preparar el .zip de despliegue, EXCLUYE:
- `.git/`
- `.github/`
- `web/node_modules/`
- `web/src/`
- `web/dist/` (El contenido ya lo copiaste a public/)
- `node_modules/` (Si vas a correr composer install en producción)
- `tests/`
- `.env` (No sobrescribas el de producción)
- `storage/logs/` (Para no sobrescribir o borrar logs productivos)
- Archivos basura (como `.phpunit.result.cache`)
