import { adminFetch } from '@/auth/adminApiSession';
import type { InventoryDevicesGateway } from '../application/inventory.contracts';
import type {
  DeviceDestination,
  DismantlingStatus,
  DevicePhysicalCondition,
  DevicePowerState,
  InventoryDeviceListItemDto,
} from '../application/devices.dto';

type ApiInventoryItem = {
  id: string;
  sku?: string | null;
  title: string;
  item_type: string;
  brand?: string | null;
  model?: string | null;
  operational_status: string;
  inventory_purpose: string;
  dismantling_status?: string | null;
  public_listing_status?: 'draft' | 'published';
  public_valuation_id?: string | null;
  cost_amount_minor?: number | null;
  currency_code?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ApiInventoryResponse = {
  data: ApiInventoryItem[];
};

const destinationTones = {
  'Pending Evaluation': 'warning',
  Donor: 'info',
  Refurbish: 'success',
  Hold: 'neutral',
  Discard: 'neutral',
} as const;

function stringMeta(metadata: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function physicalCondition(metadata: Record<string, unknown> | null | undefined): DevicePhysicalCondition {
  const value = stringMeta(metadata, 'physical_condition', 'condition');
  return value === 'Excellent' || value === 'Good' || value === 'Fair' || value === 'Poor' || value === 'Damaged'
    ? value
    : 'Unknown';
}

function powerState(metadata: Record<string, unknown> | null | undefined): DevicePowerState {
  const value = stringMeta(metadata, 'powers_on');
  return value === 'Yes' || value === 'No' ? value : 'Unknown';
}

function destination(item: ApiInventoryItem): DeviceDestination {
  const explicit = stringMeta(item.metadata, 'destination');
  if (explicit === 'Pending Evaluation' || explicit === 'Donor' || explicit === 'Refurbish' || explicit === 'Hold' || explicit === 'Discard') {
    return explicit;
  }

  switch (item.inventory_purpose) {
    case 'parts_donor':
    case 'sell_as_spare_part':
      return 'Donor';
    case 'repair_then_sell':
    case 'sell_as_used_phone':
      return 'Refurbish';
    case 'discard':
      return 'Discard';
    case 'internal_use':
    case 'repair_for_customer':
      return 'Hold';
    default:
      return 'Pending Evaluation';
  }
}

function money(amountMinor?: number | null, currencyCode?: string | null): string {
  if (amountMinor === null || amountMinor === undefined) return '—';

  const currency = currencyCode || 'UYU';
  try {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

function isDismantlingStatus(value: unknown): value is DismantlingStatus {
  return value === 'unknown' || value === 'not_started' || value === 'partial' || value === 'exhausted';
}

function mapDevice(item: ApiInventoryItem): InventoryDeviceListItemDto {
  const mappedDestination = destination(item);
  const accountLock = stringMeta(item.metadata, 'account_lock');

  return {
    id: item.sku?.trim() || item.id,
    inventoryId: item.id,
    isDonor: item.inventory_purpose === 'parts_donor',
    dismantlingStatus: isDismantlingStatus(item.dismantling_status) ? item.dismantling_status : 'unknown',
    publicListingStatus: item.public_listing_status === 'published' ? 'published' : 'draft',
    publicValuationId: item.public_valuation_id ?? null,
    manufacturer: item.brand?.trim() || 'Sin marca',
    model: item.model?.trim() || item.title,
    serialOrImei: stringMeta(item.metadata, 'serial_or_imei', 'imei', 'serial') || '—',
    storage: stringMeta(item.metadata, 'storage', 'storage_capacity') || '—',
    color: stringMeta(item.metadata, 'color') || '—',
    powersOn: powerState(item.metadata),
    physicalCondition: physicalCondition(item.metadata),
    accountLock: accountLock === 'Clear' || accountLock === 'Locked' ? accountLock : 'Unknown',
    acquisitionSource: stringMeta(item.metadata, 'acquisition_source', 'source') || '—',
    acquisitionCost: money(item.cost_amount_minor, item.currency_code),
    destination: mappedDestination,
    destinationTone: destinationTones[mappedDestination],
  };
}

export class ApiInventoryDevicesGateway implements InventoryDevicesGateway {
  async updateDismantling(inventoryId: string, status: Exclude<DismantlingStatus, 'unknown'>): Promise<void> {
    const response = await adminFetch('/api/v1/admin/inventory/' + encodeURIComponent(inventoryId) + '/dismantling', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismantling_status: status }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as
        | { message?: string; errors?: Record<string, string[]> } | null;
      const error = payload?.errors ? Object.values(payload.errors).flat().join(' ') : '';
      throw new Error(error || payload?.message || 'No se pudo cambiar el estado de despiece (' + response.status + ').');
    }
  }

  async listDevices(): Promise<readonly InventoryDeviceListItemDto[]> {
    const response = await adminFetch('/api/v1/admin/inventory', {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`No se pudo cargar el inventario (${response.status}).`);
    }

    const payload = (await response.json()) as ApiInventoryResponse;
    if (!Array.isArray(payload.data)) {
      throw new Error('La API devolvió un formato de inventario inválido.');
    }

    return payload.data.map(mapDevice);
  }
}
