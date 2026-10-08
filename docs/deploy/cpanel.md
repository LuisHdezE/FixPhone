# Guía de Despliegue en cPanel para FixPhone

Este documento describe cómo desplegar el proyecto FixPhone (Laravel API + React SPA) en un hosting compartido cPanel. Siguiendo el patrón arquitectónico de DulceHogar, el despliegue se automatiza mediante GitHub Actions usando FTP.

## 1. Estrategia FTP

A diferencia de otros despliegues que requieren acceso SSH/SCP, FixPhone utiliza `SamKirkland/FTP-Deploy-Action` para transferir los archivos de forma segura e independiente a dos directorios de cPanel:
- La aplicación privada (Laravel) se sube a `/home/usuario/fixphone_app` (o su equivalente).
- Los archivos públicos (Frontend, assets y un proxy `index.php`) se suben a `/home/usuario/public_html` (o el document root del dominio).

Esta estrategia divide el empaquetado en dos carpetas locales (`deploy-output/app` y `deploy-output/public`) gestionadas por `scripts/prepare-deploy.ps1`.

## 2. Configurar Secretos en GitHub

Ve a **Settings > Secrets and variables > Actions** y configura los siguientes secretos:

### Secretos de la Aplicación y Base de Datos
- `APP_KEY`: Clave generada por Laravel (`php artisan key:generate --show`).
- `DB_HOST`: Host de la DB (usualmente `127.0.0.1` o `localhost`).
- `DB_DATABASE`: Nombre de la DB creada en cPanel.
- `DB_USERNAME`: Usuario de la DB.
- `DB_PASSWORD`: Contraseña del usuario.

### Secretos de FTP
- `FTP_SERVER`: IP o dominio del servidor FTP (ej. `ftp.eliasworks.uy`).
- `FTP_APP_USERNAME`: Usuario FTP configurado para acceder **únicamente** a la carpeta privada de la aplicación (ej. `/home/usuario/fixphone_app`).
- `FTP_APP_PASSWORD`: Contraseña del usuario FTP de la app.
- `FTP_PUBLIC_USERNAME`: Usuario FTP configurado para acceder **únicamente** a la carpeta pública del dominio (ej. `/home/usuario/fixphone.eliasworks.uy`).
- `FTP_PUBLIC_PASSWORD`: Contraseña del usuario FTP público.

## 3. Preparación Inicial en cPanel (Crear cuentas FTP)

1. En cPanel, crea la carpeta privada para la aplicación: `mkdir -p /home/<usuario>/fixphone_app`.
2. Ve a **Cuentas FTP** en cPanel y crea dos cuentas distintas:
   - Cuenta APP: apúntala al directorio base de la app (`/home/<usuario>/fixphone_app`).
   - Cuenta PUBLIC: apúntala al document root del dominio (ej. `/home/<usuario>/fixphone.eliasworks.uy`).
3. Agrega estas credenciales a los secretos de GitHub correspondientes.
4. Asegúrate de tener una base de datos MySQL lista y asignada al usuario configurado en los secretos de la DB.

## 4. Ejecutar el Deploy

En GitHub:
1. Ve a la pestaña **Actions**.
2. Selecciona el workflow **Deploy to cPanel (FTP)**.
3. Haz clic en **Run workflow**.

El workflow automáticamente:
- Correrá tests backend e instalará dependencias productivas (sin `require-dev`).
- Construirá el frontend (`npm run build`) y moverá los resultados.
- Generará un `.env` dinámico usando los GitHub Secrets.
- Dividirá el código mediante `prepare-deploy.ps1`.
- Transferirá por FTP tanto la carpeta privada como la pública.

## 5. Tareas Post-Deploy Manuales

Dado que este es el MVP, **no se corren migraciones automáticamente**. Una vez que termine el workflow en GitHub, debes conectarte por SSH o Terminal de cPanel y ejecutar:

```bash
cd /home/<usuario>/fixphone_app
php artisan storage:link
php artisan migrate --force
```

También es recomendable limpiar cachés de optimización si ocurre algún comportamiento inesperado:
```bash
php artisan optimize:clear
```

## 6. Verificaciones post-deploy

Para validar que el despliegue fue exitoso, prueba acceder a los siguientes endpoints y páginas en producción:

1. Frontend (React SPA):
   [https://fixphone.eliasworks.uy/store/products](https://fixphone.eliasworks.uy/store/products)
2. Backend (API JSON):
   [https://fixphone.eliasworks.uy/api/v1/store/products](https://fixphone.eliasworks.uy/api/v1/store/products)
