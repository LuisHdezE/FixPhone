import { adminFetch } from '@/auth/adminApiSession';
import type { DeviceValuation, ValuationPayload } from '../application/valuation.types';

type ListResponse = { data: DeviceValuation[] };
type OneResponse = { data: DeviceValuation };

async function checked<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;

  const data = await response.json().catch(() => null) as
    | { message?: string; errors?: Record<string, string[]> } | null;
  const errors = data?.errors ? Object.values(data.errors).flat().join(' ') : '';
  throw new Error(errors || data?.message || 'No se pudo guardar el valuador (' + response.status + ').');
}

export class ApiValuationGateway {
  async list(): Promise<DeviceValuation[]> {
    const response = await adminFetch('/api/v1/admin/valuations');
    return (await checked<ListResponse>(response)).data;
  }

  async save(payload: ValuationPayload, id?: string): Promise<DeviceValuation> {
    const url = id
      ? '/api/v1/admin/valuations/' + encodeURIComponent(id)
      : '/api/v1/admin/valuations';
    const response = await adminFetch(url, {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await checked<OneResponse>(response)).data;
  }
}
