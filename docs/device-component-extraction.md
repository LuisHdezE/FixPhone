# Planilla de componentes recuperados

## Uso

1. Registrar o buscar el teléfono en Dispositivos. Debe tener marca/modelo del catálogo y destino **Donor / despiece**.
2. Pulsar el icono de paquete **Extraer componentes** en su fila. La marca y modelo se heredan del donante, sin introducirlos pieza a pieza.
3. Marcar los componentes realmente recuperados. Cada selección representa exactamente una unidad. El catálogo de tipos es administrable; esta entrega añade cámaras frontal y trasera bajo Cámara si ese tipo padre existe.
4. Declarar por pieza **Sin probar / Funcional / Con fallas**. Opcionalmente indicar precio, moneda e imagen pública HTTPS. Marcar **Publicar** solo para las piezas funcionales con precio.
5. Guardar. Se crea el repuesto REP si no existe uno equivalente, o se suma +1 al existente. El resultado informa cuántos se crearon y cuántos se actualizaron.
6. Para completar o retirar una publicación después, usar **Inventario → icono tienda → Publicación de repuesto**. Desde allí se indica condición, precio, moneda, imagen y publicación. La condición declarada abarca todas las unidades agrupadas en esa ficha.

La compatibilidad proviene del modelo seleccionado. La planilla no afirma que todos los tipos genéricos existan físicamente en todos los modelos; el operador selecciona los recuperados. Nuevos tipos se administran en Catálogo maestro.

## Identidad y trazabilidad

La identidad de un artículo recuperado combina marca, modelo, tipo de pieza, condición, propietario y moneda. Solo piezas equivalentes comparten existencias. Dos donantes propios del mismo modelo aportan dos unidades al mismo repuesto. Un consignante diferente o una condición diferente producen otra ficha. No se convierten piezas nuevas o de origen desconocido en recuperadas por similitud de nombre.

`device_extraction_batches` conserva solicitud UUID, hash, actor y resultado. `device_part_extractions` conserva donante, repuesto, tipo, condición y cantidades antes/después, con snapshot de marca/modelo y propiedad. Además se escribe un ajuste +1 en el historial operativo con el código FXP de procedencia.

Cada donante puede aportar una vez cada tipo. Un reintento con la misma UUID y contenido devuelve el resultado sin sumar de nuevo. El mismo tipo con otra UUID se rechaza. No se permite seleccionar un padre y un hijo del catálogo a la vez; las variantes OLED/LCD también son excluyentes. Cámaras frontal y trasera son componentes diferentes.

Todas las piezas seleccionadas se guardan en una sola transacción. Un fallo revierte altas, stock, secuencia REP, publicación y registros del lote. El bloqueo del contador REP serializa creación y búsqueda entre donantes. Las restricciones únicas protegen identidad y solicitudes.

## Donante y economía

El donante pasa a despiece parcial y pierde su publicación como equipo completo. Conserva stock 1 como unidad física remanente, su costo original y su propietario; no se marca agotado automáticamente por desconocer qué otras piezas quedan. Se puede completar el despiece y marcar agotado mediante el estado existente.

No se extraen componentes de equipos agotados, vendidos o comprometidos en pedidos abiertos. Una vez extraídas piezas, no se permite editar la identidad/titularidad del donante ni venderlo como equipo completo. Las piezas de consignación conservan consignor_id y no se mezclan con las propias.

Esta operación no reparte el costo de adquisición del teléfono entre las piezas ni inventa costo cero. Los repuestos nuevos se crean con costo desconocido (NULL). Tampoco liquida al consignante ni realiza asientos contables; ese cálculo queda fuera de esta entrada física.

## Publicación

Guardar existencias no implica publicar. La publicación exige condición funcional, precio positivo y stock disponible. Los datos incompletos quedan en inventario. La URL de imagen es opcional y debe ser HTTPS; sin ella se muestra una imagen neutra local. Se pueden usar URLs públicas del almacenamiento configurado; esta pantalla no sube archivos ni expone credenciales.

Los recuperados se muestran como **Usado recuperado**, con precio en unidades monetarias (minor / 100), moneda real, cantidad y ficha dinámica. Home, catálogo y detalle usan los productos públicos. La API pública no entrega costos, consignantes, snapshots del donante ni metadatos privados. Al quedar sin stock, la consulta pública los excluye.

Una entrada posterior no sobrescribe el precio de un artículo existente: si se envía un importe diferente, el lote se rechaza para revisión. Dejar el importe vacío conserva el precio anterior. Para cambiarlo, usar Publicación. Cambiar condición/moneda desde Publicación se bloquea si la nueva identidad ya pertenece a otra ficha; no fusiona stock silenciosamente.

## Permisos y verificación

Consultar planilla requiere inventory.view. Extraer exige workshop.dismantle e inventory.adjust. Publicar exige además catalog.manage. Las acciones de publicación en Inventario requieren catalog.manage. No hay endpoints públicos de modificación.

Pruebas PHP: creación +1, agregación entre donantes, separación por propietario/condición, idempotencia, conflictos de jerarquía, reversión del lote, permisos, estados del donante, persistencia y exposición pública. Prueba frontend del proveedor: listado/home/detalle dinámico, etiqueta recuperada, precio minor/100 y ausencia de productos demo cuando la API está vacía.

La limpieza previa de producción se verificó en la ejecución 38776045707: 60 repuestos eliminados, cero restantes, respaldo cifrado verificado y próximo código REP-0001. Esta entrega no repite ninguna limpieza.


### Nombres, descripciones y variantes

La ficha propone `Tipo · Marca Modelo · Variante · Recuperado` y una descripción factual propia. Ambos textos se pueden editar antes de guardar o desde Publicación de repuesto. La condición funcional se presenta en su campo separado; el texto automático no afirma originalidad, pruebas ni compatibilidad con otros modelos.

Variante es un campo explícito (hasta 120 caracteres) para color, marco, revisión, conjunto u otras diferencias comprobadas. Forma parte de la identidad de existencias; mayúsculas y espacios repetidos no crean otro artículo. Una variante vacía no coincide con una informada. Los títulos y descripciones no se usan para decidir equivalencia ni se sobrescriben al sumar unidades a un artículo existente. Para corregirlos se utiliza la publicación. La variante queda en el snapshot de extracción y no se edita desde publicación. Elegir otra variante tampoco permite extraer dos veces la misma pieza del mismo donante.

Se añaden opciones para pin suelto, placa y flex de carga, auricular interno, tapa trasera, bandeja SIM, vibrador y flex de encendido. Los tres formatos de carga son alternativas excluyentes por donante: no se cuenta el conector separado y además su conjunto completo. La planilla sigue siendo selección manual; no supone que cada modelo incluya todas las piezas.

Referencia editorial consultada: https://www.carmelimportaciones.com/productos/?path=0.2547&secc=productos (15/10/2026). Se tomó el criterio de identificar pieza, marca, modelo y características; no se importan descripciones, fotografías, precios ni compatibilidades del proveedor.
