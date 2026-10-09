import { adminFetch } from '@/auth/adminApiSession';
import type { RepairQuote, RepairQuotePayload } from '../application/repairQuote.types';

type RepairQuoteListResponse = { data: RepairQuote[] };
type RepairQuoteResponse = { data: RepairQuote };

async function handle<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  const payload = await response.json().catch(() => null) as
    { message?: string; errors?: Record<string, string[]> } | null;
  const details = payload?.errors ? Object.values(payload.errors).flat().join(' ') : '';
  throw new Error(details || payload?.message || 'No fue posible completar el presupuesto (' + response.status + ').');
}
export class ApiRepairQuoteGateway {
  async list(): Promise<RepairQuote[]> {
    const response = await adminFetch('/api/v1/admin/repair-quotes');
    return (await handle<RepairQuoteListResponse>(response)).data;
  }

  async create(quote: RepairQuotePayload): Promise<RepairQuote> {
    const response = await adminFetch('/api/v1/admin/repair-quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quote),
    });
    return (await handle<RepairQuoteResponse>(response)).data;
  }
}
