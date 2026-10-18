export type PromotionalAssetStatus = 'prepared' | 'uploaded' | 'approved' | 'discarded';

export interface PromotionalAsset {
  id: string;
  inventory_item_id: string;
  source_photo_id: string;
  source_photo_url?: string | null;
  prompt_code: string;
  prompt_version: string;
  prompt_snapshot: string;
  status: PromotionalAssetStatus;
  image_url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DeviceSummary {
  codigo_fxp: string | null;
  modelo: string | null;
  precio: string | null;
  moneda: string | null;
  ram: string | null;
  almacenamiento: string | null;
  color: string | null;
  condicion: string | null;
  defectos: string | null;
  garantia: string | null;
  caracteristicas_destacadas: string | null;
}

export interface PreparePromotionalAssetResponse {
  data: PromotionalAsset;
  device_summary: DeviceSummary;
  warnings: string[];
}

export interface PromotionalAssetUploadGrant {
  asset_id: string;
  upload_url: string;
  content_type: string;
}

export interface PromotionalAssetsSummary {
  total: number;
  prepared: number;
  uploaded: number;
  approved: number;
  discarded: number;
  empty_prepared: number;
}

export interface PromotionalAssetsListResponse {
  data: PromotionalAsset[];
  summary: PromotionalAssetsSummary;
}

export interface BulkDeleteEmptyPreparedResponse {
  deleted_count: number;
  remaining_count: number;
  message: string;
}

