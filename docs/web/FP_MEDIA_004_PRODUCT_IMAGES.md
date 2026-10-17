# FP-MEDIA-004 — Imágenes de la tienda en R2

Las imágenes de campañas, productos y modelos se eligen desde la administración. El navegador convierte JPG, PNG o WebP a WebP de hasta 2048 px y 2 MB, eliminando metadatos de cámara. Solicita una URL PUT firmada al backend, sube el archivo directamente al bucket R2 y comprueba que la URL pública cargue como imagen antes de devolverla al formulario. El servidor de FixPhone firma la petición con el perfil R2 seleccionado y no transporta el binario.

La subida no guarda ni publica la ficha. Hay que pulsar **Guardar** para asociar la URL al producto, modelo o campaña. Las fichas anteriores conservan sus URLs. Los endpoints antiguos de subida por servidor siguen disponibles para compatibilidad, aunque la interfaz utiliza la ruta directa.

## Configuración y prueba en producción

1. En **Administración → Almacenamiento de imágenes**, seleccionar un perfil R2 con bucket, endpoint, URL pública y credenciales válidos. La opción **Probar conexión** usa la red del hosting y puede seguir fallando aunque la subida directa funcione.
2. Configurar en el bucket la política CORS documentada en [FP-MEDIA-002](FP_MEDIA_002_R2_DIRECT_UPLOAD.md): origen exacto `https://fixphone.eliasworks.uy`, método `PUT` y encabezado `Content-Type`. La regla ya estaba prevista para ValuPhone; comprobar que esté aplicada al bucket seleccionado.
3. Seleccionar una imagen en un modelo (por ejemplo A226), producto o campaña. Esperar a que la interfaz confirme que se subió y que la miniatura pública cargue; pulsar **Guardar**.
4. Abrir la ficha pública de la tienda y comprobar la imagen. Para el modelo A226, verificar la asociación desde el catálogo y desde un dispositivo que use ese modelo.

`POST /api/v1/admin/store/images/presign` requiere `catalog.manage` y tiene un límite de diez solicitudes por minuto. Valida el tipo WebP y el tamaño declarado de 2 MB, restringe la ruta a campañas, productos y modelos y devuelve una firma PUT válida durante 180 segundos. Las credenciales cifradas nunca salen del servidor. El navegador solo recibe la URL firmada temporal, que debe tratarse como autorización de escritura mientras esté vigente.

La comprobación de la interfaz valida la respuesta PUT y que la URL pública muestra una imagen. No comprueba desde el servidor el tamaño real ni el tipo del objeto escrito: el tamaño se valida al preparar el archivo en el navegador y el PUT firma `Content-Type`. Una firma usada fuera de la interfaz podría enviar más bytes de los declarados. Las imágenes cargadas sin guardar la ficha pueden quedar huérfanas; la limpieza futura requiere una política de retención. Este cambio no crea una galería con varias fotos por producto.
