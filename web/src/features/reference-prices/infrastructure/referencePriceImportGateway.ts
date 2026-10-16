import { adminFetch } from '@/auth/adminApiSession';

export const REFERENCE_PRICE_HEADER = 'source,source_country,source_url,observed_date,brand,model,service_code,service_name,currency,price_amount,tax_included,price_type,notes';

export type ImportSummary = { total: number; new: number; duplicate: number; errors: number };
export type ImportError = { row: number; message: string };
export type ImportPriceRow = {
  source: string; model: string; service_name: string; observed_date: string;
  currency: string; price_amount: string; status: 'new' | 'duplicate';
};
export type ImportPreview = {
  valid: boolean; summary: ImportSummary; errors: ImportError[];
  preview: ImportPriceRow[]; batch_id: string | null; expires_at?: string;
};
export type ImportedBatch = {
  id: string; file_name: string; total_rows: number; inserted_rows: number;
  duplicate_rows: number; committed_at: string; file_sha256: string;
};
export type ImportCommit = {
  id: string; inserted: number; duplicate: number; already_confirmed: boolean;
};

async function parse<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    let detail = 'Error de importación';
    if (payload && typeof payload === 'object') {
      if ('detail' in payload && typeof payload.detail === 'string') detail = payload.detail;
      else if ('message' in payload && typeof payload.message === 'string') detail = payload.message;
      if ('errors' in payload && payload.errors && typeof payload.errors === 'object') {
        const messages = Object.values(payload.errors).flatMap((value) => Array.isArray(value) ? value : []);
        if (messages.length) detail = messages.map(String).join(' ');
      }
    }
    throw new Error(detail + ' (HTTP ' + response.status + ')');
  }
  if (!payload || typeof payload !== 'object') throw new Error('El servidor devolvió una respuesta vacía.');
  return payload as T;
}

export async function previewReferencePrices(file: File): Promise<ImportPreview> {
  const data = new FormData();
  data.append('file', file);
  return parse<ImportPreview>(await adminFetch('/api/v1/admin/reference-prices/imports/preview', {
    method: 'POST', body: data,
  }));
}
export async function confirmReferencePrices(batchId: string): Promise<ImportCommit> {
  const response = await adminFetch('/api/v1/admin/reference-prices/imports/' + encodeURIComponent(batchId) + '/confirm', {
    method: 'POST',
  });
  return (await parse<{ data: ImportCommit }>(response)).data;
}
export async function listReferencePriceImports(): Promise<ImportedBatch[]> {
  return (await parse<{ data: ImportedBatch[] }>(
    await adminFetch('/api/v1/admin/reference-prices/imports'),
  )).data;
}

export type ImportedObservation = {
  source: string; source_country: string; source_url: string;
  observed_date: string; brand: string; model: string;
  service_code: string; service_name: string; currency: string;
  price_minor: number; minor_digits: number; tax_included: string;
  price_type: string; notes: string | null;
};
export type ImportBatchDetail = {
  batch: ImportedBatch & { created_by: string };
  rows: ImportedObservation[];
  rows_limit: number;
};
export async function getReferencePriceImport(batchId: string): Promise<ImportBatchDetail> {
  const response = await adminFetch('/api/v1/admin/reference-prices/imports/' + encodeURIComponent(batchId));
  return (await parse<{ data: ImportBatchDetail }>(response)).data;
}
