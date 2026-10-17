# Mensajes comerciales dentro del carrusel

Fecha: 2026-10-17. Continúa el diseño aprobado de la PR #132 y el ajuste de altura de la PR #133.

El usuario confirmó envíos en Montevideo y al interior; al interior mediante DAC y con costo a cargo del cliente. No se anuncian entrega en el día, envío gratis, transportista específico para Montevideo ni años de actividad.

La portada incorpora tres mensajes con iconos dentro del carrusel:
- Presupuesto sin costo / En reparaciones.
- Garantía de 1 mes / Consultá las condiciones.
- Envíos en Montevideo y al interior / Interior por DAC · Envío a cargo del cliente.

Los mensajes son comunes a las diapositivas y permanecen visibles al navegar entre anuncios. Presupuesto abre contacto; garantía abre condiciones; envíos abre el WhatsApp configurado en el shell. No se cambian anuncios guardados ni datos del catálogo.

Se elimina la franja externa que repetía los beneficios, dejando las categorías inmediatamente después del carrusel. Se conserva la reducción de altura del 15 % preparada en la PR #133: escritorio, mínimo 374 px y altura clamp(340px,29.75vw,433.5px); tablet 331,5 px; móvil 459 px. El contenido y los controles reservan espacio para los mensajes dentro de esa altura; en pantallas pequeñas los iconos se apilan sobre cada texto.

Validación local: npm.cmd run check (typecheck, build y 22 pruebas frontend). Las pruebas SSR comprueban los mensajes de envíos y que presupuesto no aparece duplicado. No hay cambios de backend ni migraciones. La revisión visual interactiva de la nueva composición queda pendiente.

La PR #133 se actualiza con este alcance completo; la aprobación del HEAD anterior no debe reutilizarse.
