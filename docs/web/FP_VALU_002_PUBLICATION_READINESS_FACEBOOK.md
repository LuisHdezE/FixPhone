# FP-VALU-002 · Publicación individual con checklist y captación desde Facebook

## Contexto comercial

FixPhone vende iPhone bloqueados, sin señal o con fallas de placa **por unidad** y de forma transparente, para atraer consultas y seguidores antes de ampliar la tienda de repuestos. No hay publicación por lotes. Cada teléfono público tiene su propia ruta `/store/for-parts/{valuationId}`.

## Cambios

- ValuPhone muestra una comprobación orientativa (6 requisitos): ficha guardada, equipo de inventario real **para repuestos** con stock positivo, precio de publicación mayor que cero, fotografía real HTTPS, descripción pública suficientemente extensa y confirmación de procedencia legítima.
- La validación del cliente NO sustituye los gates en Laravel, que siguen siendo autoridad y filtran el catálogo público en cada consulta.
- Los botones «Abrir ficha pública individual» y «Copiar enlace para Facebook» sólo aparecen cuando la API ya ha devuelto el anuncio como `published` y la selección de la interfaz continúa como publicada.
- La opción **Generar texto** añade la URL completa del equipo en FixPhone sólo cuando existe una ficha guardada y publicada; en ese caso usa el registro persistido (no modificaciones sin guardar) como origen.
- Se elimina un riesgo del generador anterior: copiaba `notes` («Estado y piezas aprovechables»), que es un campo **privado** y puede contener información interna del taller. El texto ahora sólo incluye la descripción pública editada expresamente, junto con los datos públicos de la unidad.
- Publicaciones y copiado continúan siendo manuales; no se publican anuncios ni se cambia stock automáticamente.

## Plan de pruebas manuales

1. Abrir una valoración nueva en ValuPhone. Check inicial 0–N; sin enlace público, sin CTA de enlace.
2. Guardar borrador y confirmar que no aparece en `/store/for-parts`, aunque tenga fotos. El checklist puede señalar pendientes.
3. Vincular un inventario sin clasificar como parts_donor o con stock 0: checklist lo señala como no apto, y backend bloquea publicación.
4. Marcar equipo real parts_donor con stock, indicar precio, foto HTTPS, descripción honesta (mínimo 20 caracteres) y procedencia legítima. Guardar como ficha publicada, si el backend lo permite.
5. Una vez que la API devuelve estado `published`, aparece el enlace, y «Generar texto» incluye una URL completa de `fixphone.eliasworks.uy/store/for-parts/{id}`.
6. Agregar a `notes` el texto de prueba `SECRETO_INTERNO_NO_PUBLICAR`; regenerar texto de Facebook y confirmar que no aparece, mientras sí se incluye la descripción pública.
7. Cambiar estado a borrador y guardar: dejan de aparecer los botones del enlace público; la API pública no debe mostrar la ficha.
8. Editar precio o descripción sin guardar y generar texto para una ficha publicada: utiliza los valores guardados, y advierte sobre modificaciones pendientes.
9. Abrir página pública; comprobar que no muestra datos internos, inventario privado, IMEI ni cifras mínimas/estimadas.

## Dependencias

Esta mejora **no depende de Cloudflare R2**. Para publicar nuevos equipos reales sí se requiere una fotografía HTTPS de la unidad, mediante R2 cuando vuelva a funcionar o mediante un almacenamiento válido de fotografías que el propietario autorice. Las fotos de borradores siguen siendo privadas desde el punto de vista del catálogo.

## Validación

Ejecutar las suites existentes del repositorio (Laravel Feature Tests, TypeScript typecheck y build React). La UI no dispone de suite de pruebas E2E automatizada; realizar el smoke descrito antes de dar por cerrado el flujo comercial.
