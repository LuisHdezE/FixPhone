# FixPhone

FixPhone is a greenfield software product governed by `LuisHdezE/SoftwareDevelopmentBlueprint`.

Project bootstrap is intentionally minimal. Product implementation begins only after the governed Blueprint consumer bootstrap and Discovery checkpoints are approved.

## Entorno de Demostración (DemoSeeder)

El sistema incluye un generador de datos ficticios (`DemoSeeder`) diseñado para evaluar reportes financieros, inventario y dashboards sin afectar datos reales. Por seguridad, **está estrictamente desactivado** en producción y por defecto.

Para habilitar el seeder en un entorno aislado de pruebas/staging, configure explícitamente las siguientes variables en su archivo `.env`:

```env
# Habilita globalmente la inserción de datos de prueba
APP_DEMO_SEEDER_ENABLED=true

# Restringe la ejecución ÚNICAMENTE a las bases de datos listadas
APP_DEMO_SEEDER_ALLOWED_DATABASES="fixphone_demo,fixphone_staging"
```

Los registros ficticios se marcan unívocamente (por ejemplo, con metadatos JSON `{"is_demo": true}` o IDs deterministas `01J00DEM00...`), lo que garantiza **idempotencia**. Cada ejecución elimina automáticamente datos generados en corridas anteriores sin tocar la información operativa o real.
