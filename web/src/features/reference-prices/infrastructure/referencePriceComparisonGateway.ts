import { adminFetch } from '@/auth/adminApiSession';

export type ServiceCode = 'BATTERY' | 'SCREEN' | 'BACK_GLASS' | 'CAMERA' | 'OTHER_DAMAGE';
export const SERVICE_NAMES: Record<ServiceCode, string> = {
  BATTERY: 'Batería',
  SCREEN: 'Pantalla',
  BACK_GLASS: 'Tapa o cristal trasero',
  CAMERA: 'Cámara',
  OTHER_DAMAGE: 'Otros daños',
};
export type ReferencePrice = {
  source: 'APPLE' | 'MUNDOMAC';
  source_country: string;
  source_url: string;
  observed_date: string;
  model: string;
  service_code: ServiceCode;
  service_name: string;
  currency: string;
  price_amount: string;
  tax_included: 'yes' | 'no' | 'unknown';
  price_type: 'published_estimate' | 'published_price';
  notes: string | null;
  is_stale: boolean;
};
export type OwnPrice = {
  id: string; model: string; service_code: ServiceCode;
  service_name: string; currency: 'USD' | 'UYU';
  price_minor: number; notes: string | null; version: number; updated_at: string;
};
export type OwnPriceInput = {
  model: string; service_code: ServiceCode; service_name: string;
  currency: 'USD' | 'UYU'; price_amount: string; notes: string;
};
export type ComparisonResult = {
  references: ReferencePrice[];
  own: OwnPrice[];
  matching_policy: string;
};
export type ComparisonOptions = { models: string[]; services: ServiceCode[] };

async function unwrap<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    let message = 'No se pudo completar la consulta.';
    if (payload && typeof payload === 'object') {
      if ('detail' in payload && typeof payload.detail === 'string') message = payload.detail;
      else if ('message' in payload && typeof payload.message === 'string') message = payload.message;
      if ('errors' in payload && payload.errors && typeof payload.errors === 'object') {
        const values = Object.values(payload.errors).flatMap((value) => Array.isArray(value) ? value : []);
        if (values.length) message = values.map(String).join(' ');
      }
    }
    throw new Error(message + ' (HTTP ' + response.status + ')');
  }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new Error('Respuesta inesperada del servidor.');
  }
  return (payload as { data: T }).data;
}
const root = '/api/v1/admin/reference-prices';
const jsonHeaders = { 'Content-Type': 'application/json' } as const;
export async function getComparisonOptions(): Promise<ComparisonOptions> {
  return unwrap<ComparisonOptions>(await adminFetch(root + '/comparison/options'));
}
export async function getComparison(model: string, service: ServiceCode): Promise<ComparisonResult> {
  return unwrap<ComparisonResult>(await adminFetch(root + '/comparison?' + new URLSearchParams({
    model, service_code: service,
  })));
}
export async function createOwnPrice(input: OwnPriceInput): Promise<OwnPrice> {
  return unwrap<OwnPrice>(await adminFetch(root + '/own-prices', {
    method: 'POST', headers: jsonHeaders, body: JSON.stringify(input),
  }));
}
export async function updateOwnPrice(id: string, price: string, notes: string, version: number): Promise<OwnPrice> {
  return unwrap<OwnPrice>(await adminFetch(root + '/own-prices/' + encodeURIComponent(id), {
    method: 'PATCH', headers: jsonHeaders,
    body: JSON.stringify({ price_amount: price, notes, expected_version: version }),
  }));
}
export async function archiveOwnPrice(id: string, version: number): Promise<void> {
  await unwrap<{ archived: boolean }>(await adminFetch(root + '/own-prices/' + encodeURIComponent(id), {
    method: 'DELETE', headers: jsonHeaders, body: JSON.stringify({ expected_version: version }),
  }));
}
