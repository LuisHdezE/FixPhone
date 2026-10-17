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
export async function uploadCampaignImage(source: File): Promise<string> {
  const image = await prepareCampaignImage(source);
  const form = new FormData(); form.append('image', image, 'campaign.webp');
  const response = await adminFetch('/api/v1/admin/store/campaigns/images', { method: 'POST', body: form });
  const body = await response.json() as { data?: { url: string }; errors?: Record<string, string[]>; detail?: string };
  if (!response.ok || !body.data?.url) throw new Error(body.errors ? Object.values(body.errors).flat().join(' ') : body.detail || 'No se pudo subir la imagen.');
  return body.data.url;
}
