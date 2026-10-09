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

export type UploadStep = 'authorization' | 'r2' | 'fallback' | 'verification';

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Error inesperado.';
}

function isNetworkError(reason: unknown): boolean {
  return reason instanceof TypeError || /failed to fetch|networkerror|network request failed|load failed/i.test(messageOf(reason));
}

export class ValuationPhotosGateway {
  private readonly base = '/api/v1/admin/valuations/';

  async list(valuationId: string): Promise<ValuationPhoto[]> {
    return (await result<{ data: ValuationPhoto[] }>(await adminFetch(
      this.base + encodeURIComponent(valuationId) + '/photos',
    ))).data;
  }

  async upload(valuationId: string, image: Blob, onStep?: (step: UploadStep) => void): Promise<ValuationPhoto> {
    const base = this.base + encodeURIComponent(valuationId) + '/photos';
    // Distinguish errors at each hop without ever logging or displaying signed URLs.
    onStep?.('authorization');
    let grant: PresignedUpload;
    try {
      grant = (await result<{ data: PresignedUpload }>(await adminFetch(
        base + '/presign',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_type: image.type, byte_size: image.size }),
        },
      ))).data;
    } catch (reason) {
      if (isNetworkError(reason)) {
        throw new Error('No se pudo contactar la API de FixPhone para autorizar la imagen. Comprobá tu conexión y volvé a intentarlo.');
      }
      throw new Error('FixPhone no pudo autorizar la imagen: ' + messageOf(reason));
    }

    // Direct browser -> R2. Never send the FixPhone Bearer token to Cloudflare.
    onStep?.('r2');
    let transfer: Response;
    try {
      transfer = await fetch(grant.upload_url, {
        method: 'PUT',
        body: image,
        headers: { 'Content-Type': grant.content_type },
      });
    } catch (reason) {
      if (isNetworkError(reason)) {
        // Same authorized reservation and object key. Never expose the signed
        // R2 URL to the relay API or permanently save photos on the hosting.
        onStep?.('fallback');
        const multipart = new FormData();
        multipart.append('photo', image, 'fixphone-photo.webp');
        try {
          return (await result<{ data: ValuationPhoto }>(await adminFetch(
            base + '/' + encodeURIComponent(grant.id) + '/relay',
            { method: 'POST', body: multipart },
          ))).data;
        } catch (fallbackReason) {
          if (isNetworkError(fallbackReason)) {
            throw new Error(
              'Ni la subida directa a R2 ni la ruta alternativa de FixPhone respondieron. ' +
              'Revisá tu conexión y probá «Probar conexión» en Administración → Almacenamiento de imágenes.'
            );
          }
          throw new Error(
            'El navegador no pudo conectar con R2; la alternativa por FixPhone también falló: ' + messageOf(fallbackReason)
          );
        }
      }
      throw new Error('Falló la transferencia a Cloudflare R2: ' + messageOf(reason));
    }
    if (!transfer.ok) {
      throw new Error(
        'Cloudflare R2 rechazó la carga (HTTP ' + transfer.status + '). ' +
        'Verificá los permisos Object Read & Write del token, el bucket y la firma temporal.'
      );
    }

    onStep?.('verification');
    try {
      return (await result<{ data: ValuationPhoto }>(await adminFetch(
        base + '/' + encodeURIComponent(grant.id) + '/confirm',
        { method: 'POST' },
      ))).data;
    } catch (reason) {
      if (isNetworkError(reason)) {
        throw new Error(
          'La fotografía se envió a R2, pero FixPhone no pudo confirmar la subida. No vuelvas a publicarla; ' +
          'revisá tu conexión y comprobá primero la galería.'
        );
      }
      throw new Error('La foto llegó a R2, pero no se pudo verificar: ' + messageOf(reason));
    }
  }

  async primary(valuationId: string, photoId: string): Promise<string> {
    const base = this.base + encodeURIComponent(valuationId) + '/photos';
    return (await result<{ data: { primary_url: string } }>(await adminFetch(
      base + '/' + encodeURIComponent(photoId) + '/primary',
      { method: 'POST' },
    ))).data.primary_url;
  }
}
