import { adminFetch } from '@/auth/adminApiSession';
import type {
  InventoryDataState, InventoryEdit, InventoryFilter, InventoryHealth,
  InventoryItem, InventoryRepository, StockAdjustment,
} from './inventory.types';

type InventoryRecord = {
  id: string;
  sku: string | null;
  title: string;
  description: string | null;
  item_type: string;
  brand: string | null;
  model: string | null;
  inventory_purpose: string;
  operational_status: string;
  publication_status: string;
  stock_quantity: number;
  reorder_point: number | null;
  updated_at: string | null;
};

const categories: Record<string, string> = {
  device: 'Dispositivos',
  used_phone: 'Teléfonos',
  spare_part: 'Repuestos',
  accessory: 'Accesorios',
  service_part: 'Insumos',
};

function health(quantity: number, reorderPoint: number | null): InventoryHealth {
  if (quantity <= 0) return 'out-of-stock';
  if (reorderPoint === null) return 'available';
  return quantity <= reorderPoint ? 'reorder' : 'healthy';
}

function mapRecord(record: InventoryRecord): InventoryItem {
  return {
    id: record.id,
    productName: record.title,
    sku: record.sku?.trim() || record.id,
    category: categories[record.item_type] || record.item_type,
    itemType: record.item_type,
    brand: record.brand,
    model: record.model,
    description: record.description,
    inventoryPurpose: record.inventory_purpose,
    operationalStatus: record.operational_status,
    publicationStatus: record.publication_status,
    stockQuantity: record.stock_quantity,
    reorderPoint: record.reorder_point,
    health: health(record.stock_quantity, record.reorder_point),
    updatedAtLabel: record.updated_at
      ? new Date(record.updated_at).toLocaleString('es-UY')
      : 'Sin fecha',
  };
}

async function readPayload<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as
      | { message?: string; errors?: Record<string, string[]> } | null;
    const issues = body?.errors ? Object.values(body.errors).flat().join(' ') : null;
    throw new Error(issues || body?.message || 'No se pudo completar la solicitud (' + response.status + ').');
  }
  return response.json() as Promise<T>;
}

export const apiInventoryRepository: InventoryRepository = {
  async list(filter: InventoryFilter): Promise<InventoryDataState> {
    const payload = await readPayload<{ data: InventoryRecord[] }>(
      await adminFetch('/api/v1/admin/inventory/items', { cache: 'no-store' }),
    );
    if (!Array.isArray(payload.data)) throw new Error('La API devolvió un inventario inválido.');
    const search = filter.search.trim().toLocaleLowerCase('es');
    const items = payload.data.map(mapRecord).filter((item) => {
      if (filter.health !== 'all' && item.health !== filter.health) return false;
      return !search || [item.productName, item.sku, item.category, item.brand ?? '', item.model ?? '']
        .some((value) => value.toLocaleLowerCase('es').includes(search));
    });
    return items.length
      ? { status: 'success', items, total: items.length }
      : { status: 'empty', message: 'No hay artículos reales que coincidan con los filtros.' };
  },

  async update(id: string, edit: InventoryEdit): Promise<void> {
    await readPayload(await adminFetch('/api/v1/admin/inventory/items/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edit),
    }));
  },

  async adjust(id: string, delta: number, reason: string, requestId: string): Promise<void> {
    await readPayload(await adminFetch('/api/v1/admin/inventory/items/' + encodeURIComponent(id) + '/adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta, reason, request_id: requestId }),
    }));
  },

  async adjustments(id: string): Promise<readonly StockAdjustment[]> {
    const payload = await readPayload<{ data: StockAdjustment[] }>(
      await adminFetch('/api/v1/admin/inventory/items/' + encodeURIComponent(id) + '/adjustments', { cache: 'no-store' }),
    );
    if (!Array.isArray(payload.data)) throw new Error('La API devolvió movimientos inválidos.');
    return payload.data;
  },
};
