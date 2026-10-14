import { adminFetch } from '@/auth/adminApiSession';
import type { TechnicalEvaluation, TechnicalEvaluationInput } from '../application/technical-evaluations';

async function unpack<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as
    | { data?: T; errors?: Record<string, string[]>; message?: string } | null;
  if (!response.ok) {
    const validation = payload?.errors ? Object.values(payload.errors).flat().join(' ') : '';
    throw new Error(validation || payload?.message || 'No se pudo consultar la evaluación (' + response.status + ').');
  }
  if (!payload || !('data' in payload)) throw new Error('La respuesta de diagnósticos no es válida.');
  return payload.data as T;
}

function endpoint(inventoryId: string): string {
  return '/api/v1/admin/devices/' + encodeURIComponent(inventoryId) + '/technical-evaluations';
}

export const apiDeviceTechnicalEvaluationGateway = {
  async list(inventoryId: string): Promise<readonly TechnicalEvaluation[]> {
    const list = await unpack<TechnicalEvaluation[]>(await adminFetch(endpoint(inventoryId), { cache: 'no-store' }));
    if (!Array.isArray(list)) throw new Error('La API devolvió un historial inválido.');
    return list;
  },

  async create(inventoryId: string, input: TechnicalEvaluationInput): Promise<TechnicalEvaluation> {
    return unpack<TechnicalEvaluation>(await adminFetch(endpoint(inventoryId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }));
  },
};
