import { adminFetch } from '@/auth/adminApiSession';
import type { PresignedUpload, ValuationPhoto } from '../application/valuationPhotos.types';

async function result<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as
    | (T & { message?: string; errors?: Record<string, string[]> })
    | null;
  if (!response.ok) {
    const errors = body?.errors ? Object.values(body.errors).flat().join(' ') : '';
    throw new Error(errors || body?.message || 'Error al conectar con el almacenamiento (' + response.status + ')');
  }
  if (!body) throw new Error('La API no devolvió datos.');
  return body;
}

export class ValuationPhotosGateway {
  private readonly base = '/api/v1/admin/valuations/';

  async list(valuationId: string): Promise<ValuationPhoto[]> {
    return (await result<{ data: ValuationPhoto[] }>(await adminFetch(
      this.base + encodeURIComponent(valuationId) + '/photos',
    ))).data;
  }

  async upload(valuationId: string, image: Blob): Promise<ValuationPhoto> {
    const base = this.base + encodeURIComponent(valuationId) + '/photos';
    const grant = (await result<{ data: PresignedUpload }>(await adminFetch(
      base + '/presign',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_type: image.type, byte_size: image.size }),
      },
    ))).data;

    // Direct browser -> R2. Never include the FixPhone Bearer token on this request.
    const transfer = await fetch(grant.upload_url, {
      method: 'PUT',
      body: image,
      headers: { 'Content-Type': grant.content_type },
    });

    if (!transfer.ok) {
      throw new Error('R2 rechazó la fotografía (' + transfer.status + '). Revisá el CORS del bucket y los permisos del token.');
    }

    return (await result<{ data: ValuationPhoto }>(await adminFetch(
      base + '/' + encodeURIComponent(grant.id) + '/confirm',
      { method: 'POST' },
    ))).data;
  }

  async primary(valuationId: string, photoId: string): Promise<string> {
    const base = this.base + encodeURIComponent(valuationId) + '/photos';
    return (await result<{ data: { primary_url: string } }>(await adminFetch(
      base + '/' + encodeURIComponent(photoId) + '/primary',
      { method: 'POST' },
    ))).data.primary_url;
  }
}
