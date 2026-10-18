import { adminFetch } from '@/auth/adminApiSession';
import type {
  PromotionalAsset,
  PromotionalAssetsListResponse,
  BulkDeleteEmptyPreparedResponse,
  PreparePromotionalAssetResponse,
  PromotionalAssetUploadGrant,
} from '../application/promotionalAssets.types';

async function json<T>(r: Response): Promise<T> {
  const b = await r.json().catch(() => null) as (T & { message?: string; errors?: Record<string, string[]> }) | null;
  if (!r.ok) {
    const e = b?.errors ? Object.values(b.errors).flat().join(' ') : '';
    throw new Error(e || b?.message || `No se pudo completar la operación (${r.status}).`);
  }
  if (!b) throw new Error('La API no devolvió datos.');
  return b;
}

export class PromotionalAssetsGateway {
  private base(inventoryId: string): string {
    return `/api/v1/admin/inventory/${encodeURIComponent(inventoryId)}/promotional-assets`;
  }

  async list(inventoryId: string): Promise<PromotionalAssetsListResponse> {
    const res = await adminFetch(this.base(inventoryId));
    return json<PromotionalAssetsListResponse>(res);
  }

  async deleteEmptyPrepared(inventoryId: string, exceptAssetId?: string): Promise<BulkDeleteEmptyPreparedResponse> {
    const query = exceptAssetId ? `?except_asset_id=${encodeURIComponent(exceptAssetId)}` : '';
    const res = await adminFetch(`${this.base(inventoryId)}/prepared-empty${query}`, {
      method: 'DELETE',
    });
    return json<BulkDeleteEmptyPreparedResponse>(res);
  }

  async prepare(inventoryId: string, sourcePhotoId: string): Promise<PreparePromotionalAssetResponse> {
    const res = await adminFetch(`${this.base(inventoryId)}/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_photo_id: sourcePhotoId }),
    });
    return json<PreparePromotionalAssetResponse>(res);
  }

  async uploadResult(inventoryId: string, assetId: string, file: File): Promise<PromotionalAsset> {
    const base = this.base(inventoryId);
    const presignRes = await adminFetch(`${base}/${encodeURIComponent(assetId)}/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: file.type, byte_size: file.size }),
    });
    const grant = (await json<{ data: PromotionalAssetUploadGrant }>(presignRes)).data;

    let put: Response;
    try {
      put = await fetch(grant.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': grant.content_type },
      });
    } catch {
      throw new Error('No se pudo conectar con Cloudflare R2. Revisá CORS o la conexión.');
    }
    if (!put.ok) {
      throw new Error(`Cloudflare R2 rechazó la subida (HTTP ${put.status}).`);
    }

    const confirmRes = await adminFetch(`${base}/${encodeURIComponent(assetId)}/confirm`, {
      method: 'POST',
    });
    return (await json<{ data: PromotionalAsset }>(confirmRes)).data;
  }

  async approve(inventoryId: string, assetId: string): Promise<PromotionalAsset> {
    const res = await adminFetch(`${this.base(inventoryId)}/${encodeURIComponent(assetId)}/approve`, {
      method: 'POST',
    });
    return (await json<{ data: PromotionalAsset }>(res)).data;
  }

  async discard(inventoryId: string, assetId: string): Promise<PromotionalAsset> {
    const res = await adminFetch(`${this.base(inventoryId)}/${encodeURIComponent(assetId)}/discard`, {
      method: 'POST',
    });
    return (await json<{ data: PromotionalAsset }>(res)).data;
  }
}
