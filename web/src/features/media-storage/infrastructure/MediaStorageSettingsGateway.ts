import { adminFetch } from '@/auth/adminApiSession';
import type { MediaStorageProfile, MediaStorageProfileInput } from '../application/mediaStorage.types';

type ProfileResponse = { data: MediaStorageProfile };
type ProfilesResponse = { data: MediaStorageProfile[]; environment: string };

async function decode<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as
    | (T & { errors?: Record<string, string[]>; message?: string })
    | null;
  if (!response.ok) {
    const errors = body?.errors ? Object.values(body.errors).flat().join(' ') : '';
    throw new Error(errors || body?.message || 'No se pudo completar la operación (' + response.status + ').');
  }
  if (!body) throw new Error('Respuesta vacía del servidor.');
  return body;
}

export class MediaStorageSettingsGateway {
  async list(): Promise<ProfilesResponse> {
    return decode<ProfilesResponse>(await adminFetch('/api/v1/admin/media/storage-profiles'));
  }

  async save(data: MediaStorageProfileInput, id?: string): Promise<MediaStorageProfile> {
    const url = '/api/v1/admin/media/storage-profiles' + (id ? '/' + encodeURIComponent(id) : '');
    return (await decode<ProfileResponse>(await adminFetch(url, {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }))).data;
  }

  async testConnection(id: string): Promise<string> {
    const response = await adminFetch(
      '/api/v1/admin/media/storage-profiles/' + encodeURIComponent(id) + '/test',
      { method: 'POST' },
    );
    return (await decode<{ data: { reachable: boolean; detail: string } }>(response)).data.detail;
  }

  async select(id: string): Promise<MediaStorageProfile> {
    return (await decode<ProfileResponse>(await adminFetch(
      '/api/v1/admin/media/storage-profiles/' + encodeURIComponent(id) + '/select',
      { method: 'POST' },
    ))).data;
  }
}
