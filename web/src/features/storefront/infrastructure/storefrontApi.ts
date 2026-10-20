import { adminFetch } from '@/auth/adminApiSession';

export interface StoreCustomer { id: string; name: string; email: string; permissions: string[]; }
export interface CartLine {
  product_id: string; title: string; quantity: number; stock_quantity: number;
  image_url: string | null; available: boolean; unit_price_minor: number; currency_code: string;
}
export interface StoreCheckoutOrder {
  id: string; order_number: string; status: string; total_amount_minor: number;
  currency_code: string; external_reference: string; reservation_expires_at: string;
  payment_status: string | null; payment_status_detail: string | null;
  preference_id: string | null; checkout_url: string | null; payment_initiated: boolean;
  next_step: 'payment_provider' | 'redirect_to_checkout';
}
export interface StoreOrderStatus {
  id: string; order_number: string; status: string; payment_status: string | null;
  payment_status_detail: string | null; total_amount_minor: number; currency_code: string;
  reservation_expires_at: string; paid_at: string | null;
}
export interface StoreCredentials { name?: string; email: string; password: string; password_confirmation?: string; }

export async function readStoreResponse<T>(response: Response): Promise<T> {
  const body = await response.json() as { data: T; errors?: Record<string, string[]>; detail?: string; message?: string };
  if (!response.ok) throw new Error(response.status === 401 ? 'Correo o contraseña incorrectos.' :
    body.errors ? Object.values(body.errors).flat().join(' ') : body.detail || body.message || 'No se pudo completar la operación.');
  return body.data;
}
export async function authenticateStore(mode: 'sign-in' | 'register', credentials: StoreCredentials) {
  return readStoreResponse<{ access_token: string; user: StoreCustomer }>(await fetch(
    mode === 'register' ? '/api/v1/store/register' : '/api/v1/auth/login', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...credentials, device_name: 'fixphone-store' }),
    }));
}
export async function cartRequest(method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', product?: string, quantity = 1): Promise<CartLine[]> {
  const url = '/api/v1/store/cart' + (product && method !== 'POST' ? '/' + encodeURIComponent(product) : '');
  const result = await readStoreResponse<{ lines: CartLine[] }>(await adminFetch(url, {
    method, cache: 'no-store', headers: { 'Content-Type': 'application/json' },
    ...(method === 'POST' || method === 'PATCH' ? { body: JSON.stringify({ product_id: product, quantity }) } : {}),
  }));
  return result.lines;
}
export async function startStoreCheckout(idempotencyKey: string, endpoint = '/api/v1/store/checkout'): Promise<StoreCheckoutOrder> {
  return readStoreResponse<StoreCheckoutOrder>(await adminFetch(endpoint, {
    method: 'POST', cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
  }));
}
export async function readStoreOrderStatus(orderId: string): Promise<StoreOrderStatus> {
  return readStoreResponse<StoreOrderStatus>(await adminFetch('/api/v1/store/orders/' + encodeURIComponent(orderId), {
    method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' },
  }));
}
export function safeStoreReturn(value: unknown): string {
  return typeof value === 'string' && /^\/store(?:[/?#]|$)/.test(value) && !/[\\\r\n]/.test(value) ? value : '/store';
}
export function canAccessAdministration(permissions: readonly string[]): boolean { return permissions.length > 0; }
