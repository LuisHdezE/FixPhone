# FP-SOCIAL-001 · Primera ficha pública individual para repuestos

## Objetivo

Captar interesados desde publicaciones de Facebook y grupos hacia **una ficha pública por teléfono** en FixPhone. No publicar lotes. Facebook Shops no está disponible para la cuenta uruguaya de FixPhone, confirmado en Commerce Manager; se conserva el catálogo Meta **FixPhone - Productos** (ID 1981771292783447) para futuras integraciones elegibles, pero no se envían allí equipos bloqueados automáticamente.

## Jerarquía comercial

FixPhone
- Productos
  - Celulares
    - Usados/reacondicionados funcionales: /store/used-phones
    - **Equipos completos para repuestos**: /store/for-parts
  - Repuestos individuales: /store/spare-parts; a futuro filtros marca, modelo, tipo de componente
- Servicios: reparación, diagnóstico, presupuesto y microsoldadura (contenido, NO productos físicos).

## Vertical slice implementado

1. Administrador ingresa el teléfono **real** en inventario, con `item_type=used_phone|device`, `inventory_purpose=parts_donor`, `stock_quantity>=1`. Es importante registrarlo individualmente, nunca clonarlo en ValuPhone.
2. Abre ValuPhone, vincula el equipo, evalúa falla, define precio comercial en centésimos UYU y prepara texto Facebook.
3. Completa descripción **pública** (sin IMEI, datos de adquisición, costos, contactos privados, credenciales), URL HTTPS de una foto **real** y declaración de procedencia legítima. Selecciona publicar ficha web y guarda.
4. La API pública entrega solo campos permitidos en `GET /api/v1/store/parts-donors` y `GET /api/v1/store/parts-donors/{id}`.
5. Página pública `/store/for-parts/{id}` presenta ficha, fotografía, condición y precio. SEO Open Graph dinámico para compartir enlace.
6. Admin copia link de ficha para el texto de la publicación en Facebook, la sube MANUALMENTE a la página y grupos donde esté permitido. Debe evitar afirmaciones sobre desbloqueo o funcionamiento como celular.
7. Para retirar la unidad cambia visibilidad a borrador o stock a 0; la API dejará de mostrarla. La publicación en Facebook se gestiona separadamente.

## Gates de seguridad

- Valuación nueva comienza como borrador, sin publicación ni sincronización automática.
- `public_listing_status` NO equivale a `publication_status` de anuncios Facebook ni a `inventory_items.publication_status` del showroom de usados.
- Los registros históricos existentes quedan privados por la migración: `public_listing_status=draft`.
- Publicar exige: equipo vinculado, inventario parts_donor con stock positivo, precio positivo, descripción significativa, imagen HTTPS y procedencia legítima confirmada.
- La respuesta pública excluye: costo, mínimo aceptable, market_reference, notes, IMEI, metadata, created_by y URLs de Facebook privadas.
- Cuando stock pasa a cero, el elemento desaparece del showroom aunque no se haya actualizado aún el estado de ValuPhone.
- No se prometen garantías del equipo funcional ni desbloqueo de activación; verificar procedencia de cada unidad.
- No incorporar automáticamente los teléfonos iCloud en anuncios de Meta ni feed/catálogos hasta revisión de políticas y elegibilidad.
- El botón Consulta deriva a la página de contacto. **No existe WhatsApp válido configurado en landing**: el enlace de ejemplo anterior debe corregirse antes de promocionar masivamente.

## Pendientes antes de primera campaña

1. Verificar en producción el flujo de login, alta en inventario, ValuPhone y enlace público.
2. Suministrar fotografía real accesible por HTTPS. Actualmente se admite URL, no carga de archivos (pendiente futuro).
3. Sustituir el WhatsApp de ejemplo por el canal empresarial real.
4. Confirmar el enlace de la página de Facebook FixPhone para usar CTA "Seguir" con URL real.
5. Distinguir entre usado funcional, repuesto individual y equipo con fallas en reglas generales del storefront; no introducir registros simulados.
6. Elegir primer dispositivo y confirmar manualmente modelo, falla, precio, estado y procedencia antes de que quede visible.

## QA

- PHPUnit: borradores ocultos, 422 en reglas, publicación explícita, serial y notas nunca filtrados, inventario sold-out oculto, OG tags sólo cuando publicado.
- Frontend: typecheck, build, lista vacía útil, ruta pública directa y navegación.
- Smoke manual cPanel antes de enviar una publicación real.
- PR independiente, no merge automático sin aprobación del propietario.
