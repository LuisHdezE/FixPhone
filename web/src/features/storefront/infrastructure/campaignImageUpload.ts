import { adminFetch } from '@/auth/adminApiSession';

const LIMIT = 2 * 1024 * 1024;
export async function prepareCampaignImage(source: File): Promise<Blob> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(source.type)) throw new Error('Elegí una imagen JPG, PNG o WebP.');
  if (!source.size || source.size > 20 * 1024 * 1024) throw new Error('La imagen original debe pesar menos de 20 MB.');
  const image = await createImageBitmap(source);
  try {
    if (image.width < 100 || image.height < 100 || image.width > 12000 || image.height > 12000 ||
        image.width * image.height > 32000000) throw new Error('Usá una imagen de al menos 100 × 100 y hasta 32 megapíxeles.');
    const ratio = Math.min(1, 2048 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('El navegador no permite preparar la imagen.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error('No se pudo convertir la imagen.')), 'image/webp', .86));
    if (blob.type !== 'image/webp' || !blob.size || blob.size > LIMIT) throw new Error('La imagen optimizada supera 2 MB. Elegí una imagen más liviana.');
    return blob;
  } finally { image.close(); }
}
type UploadGrant = { upload_url: string; url: string; content_type: string };

function verifyPublicImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.onload = null; image.onerror = null;
      reject(new Error('R2 recibió la imagen, pero la URL pública no respondió. Revisá el dominio público del perfil R2.'));
    }, 15000);
    image.onload = () => { window.clearTimeout(timeout); resolve(); };
    image.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error('R2 recibió la imagen, pero no se pudo abrir desde la URL pública. Revisá el dominio público del perfil R2.'));
    };
    image.src = url;
  });
}

async function uploadStoreImage(source: File, kind: 'campaigns' | 'products' | 'models'): Promise<string> {
  const image = await prepareCampaignImage(source);
  const response = await adminFetch('/api/v1/admin/store/images/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, byte_size: image.size, content_type: image.type }),
  });
  const body = await response.json() as {
    data?: UploadGrant; errors?: Record<string, string[]>; detail?: string; message?: string;
  };
  if (!response.ok || !body.data?.upload_url || !body.data?.url) {
    throw new Error(body.errors ? Object.values(body.errors).flat().join(' ') :
      body.detail || body.message || 'No se pudo preparar la subida de la imagen.');
  }

  let uploaded: Response;
  try {
    uploaded = await fetch(body.data.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': body.data.content_type },
      body: image,
    });
  } catch {
    throw new Error('No se pudo subir la imagen directamente a R2. Revisá la conexión y la regla CORS del bucket para este sitio (PUT y Content-Type).');
  }
  if (!uploaded.ok) throw new Error('R2 rechazó la imagen (HTTP ' + uploaded.status + '). Revisá la configuración del bucket.');
  await verifyPublicImage(body.data.url);
  return body.data.url;
}
export function uploadCampaignImage(source: File): Promise<string> { return uploadStoreImage(source, 'campaigns'); }
export function uploadProductImage(source: File): Promise<string> { return uploadStoreImage(source, 'products'); }
export function uploadModelImage(source: File): Promise<string> { return uploadStoreImage(source, 'models'); }
