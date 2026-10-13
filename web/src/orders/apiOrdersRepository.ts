import { adminFetch } from '@/auth/adminApiSession';
import type { OrderCatalog, OrderFormInput, OrderStatus, OrderSummary, OrdersRepository } from './orders.types';

async function payload<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as
    | ({ data?: T; message?: string; errors?: Record<string, string[]> }) | null;
  if (!response.ok) {
    const errors = body?.errors ? Object.values(body.errors).flat().join(' ') : '';
    throw new Error(errors || body?.message || 'No se pudo completar la operación (' + response.status + ').');
  }
  if (!body || !('data' in body)) throw new Error('La API devolvió una respuesta inválida.');
  return body.data as T;
}

export const apiOrdersRepository: OrdersRepository = {
  async list() {
    const orders = await payload<OrderSummary[]>(await adminFetch('/api/v1/admin/orders', { cache: 'no-store' }));
    if (!Array.isArray(orders)) throw new Error('La API devolvió una lista de pedidos inválida.');
    return orders;
  },

  async catalog() {
    return payload<OrderCatalog>(await adminFetch('/api/v1/admin/orders/catalog', { cache: 'no-store' }));
  },

  async create(input: OrderFormInput) {
    return payload<OrderSummary>(await adminFetch('/api/v1/admin/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }));
  },

  async update(id: string, input: OrderFormInput) {
    return payload<OrderSummary>(await adminFetch('/api/v1/admin/orders/' + encodeURIComponent(id), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }));
  },

  async changeStatus(id: string, status: Exclude<OrderStatus, 'pending'>, reason?: string) {
    return payload<OrderSummary>(await adminFetch('/api/v1/admin/orders/' + encodeURIComponent(id) + '/status', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...(status === 'cancelled' ? { reason } : {}) }),
    }));
  },
};
