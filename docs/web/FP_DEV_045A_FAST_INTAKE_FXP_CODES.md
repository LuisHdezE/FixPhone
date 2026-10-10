# FP-DEV-045A · Registro rápido e identificación permanente de equipos

## Motivación y autorización

Esta fase de la issue #45 fue autorizada por el propietario para continuar **en paralelo a la vigilancia TLS de Cloudflare R2**, sin esperar a las 72 horas. Se preservan los límites de #45, las validaciones y la integridad de inventario. **No se implementan todavía** showroom agrupado, extracción de piezas, valoración financiera ni CRUD modal.

## Modelo existente y decisiones

- Fuente de verdad: `inventory_items` (tabla y entidad existentes). Los dispositivos físicos usan `item_type = device | used_phone`; las piezas individuales mantienen su inventario propio.
- El `id` ULID permanece como clave interna. El identificador humano legible es `sku` con patrón `FXP-0001`, `FXP-0002` y ancho mínimo de 4 dígitos, ampliable a `FXP-10000`.
- **Nunca reemplazar `sku` existente** ni renumerar datos migrados. Los clientes antiguos que envían un SKU explícito mantienen esa funcionalidad mientras se revisan integraciones; el registro nuevo de UI no envía SKU.
- `inventory_device_sequences` guarda un contador monotónico con fila fija `id=1`. La migración examina los códigos FXP presentes y comienza por el siguiente al mayor usado, evitando cambiar retrospectivamente los registros.
- `DeviceCodeAllocator::reserve()` ejecuta `SELECT ... FOR UPDATE` del contador dentro de la **transacción de alta**. Si un SKU legado coincide con el propuesto, salta al siguiente. La restricción unique sobre `inventory_items.sku` continúa siendo el último resguardo.
- Los códigos ya emitidos no se reutilizan al eliminar un dispositivo. Una transacción fallida no completa ningún alta ni reserva comprometida.
- La ruta de alta sigue siendo `POST /api/v1/admin/inventory`, protegida como antes. No se crea endpoint alternativo ni inventario paralelo.

## Registro rápido

- Obligatorios en la UI: marca, modelo y destino. Se toman de los catálogos maestros existentes.
- Opcionales: IMEI/serie, capacidad, color, condición, encendido, bloqueo, origen, costo y notas. Se presentan en un panel desplegable.
- Si no se capturan IMEI/serie o evaluación, la API recibe valores nulos o `Unknown`, nunca identificadores ficticios.
- Cada dispositivo nuevo permanece **no publicable**, **no vendible**, con stock inicial una unidad y estado operativo según el destino. No se asume que sus piezas funcionen.
- Tras guardar, se confirma el código `FXP-####` emitido por Laravel; en la tabla Dispositivos se muestra el mismo `sku` si está presente.
- No se emiten códigos FXP al crear un `spare_part`.

## Gates / revisión manual

1. Migraciones desde base vacía y con inventario legado; verificar que los identificadores previos queden intactos.
2. Dos altas con solo marca, modelo y destino, sin IMEI: deben obtener `FXP-0001` y `FXP-0002` en una base nueva.
3. Probar dos altas concurrentes desde sesiones distintas en MySQL; no se admiten códigos duplicados ni códigos reutilizados.
4. Crear equipo con destino Donante, asegurarse de que ValuPhone pueda vincularlo y que no aparezca público sin revisión, foto, descripción, procedencia y publicación autorizada.
5. Verificar que edición, catálogo y piezas existentes continúen funcionando.
6. Ejecutar suite Laravel, TypeScript typecheck y build antes del merge.
7. Validar smoke en producción después de desplegar, sin insertar registros ficticios en la base de datos real.

## Siguientes fases de #45

- **045B:** vista administrativa compacta, estado real de despiece independiente del destino, control de publicación y referencias persistentes.
- **045C:** showroom agrupado por modelo con disponibilidad calculada, seguridad de campos y contacto WhatsApp sin reservas ficticias.
- **045D:** registro de piezas extraídas y movimiento trazable para evitar doble conteo.
- **045E:** valoración administrativa real de equipo entero frente a componentes, sin suponer funcionalidad no comprobada.

Dependen del inventario real, no de que R2 esté disponible para nuevas fotos: las publicaciones nuevas sí seguirán exigiendo fotografía real HTTPS.
