import type { StatusBadgeTone } from '@/components/data-display/StatusBadge';

export type DeviceDestination = 'Pending Evaluation' | 'Donor' | 'Refurbish' | 'Hold' | 'Discard';
export type DevicePhysicalCondition = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Damaged' | 'Unknown';
export type DevicePowerState = 'Yes' | 'No' | 'Unknown';
export type DeviceAccountLock = 'Clear' | 'Locked' | 'Unknown';
export type DismantlingStatus = 'unknown' | 'not_started' | 'partial' | 'exhausted';

export type DeviceLifecycleStatus =
  | 'ingresado' | 'en_evaluacion' | 'en_espera' | 'para_reparar'
  | 'en_reparacion' | 'reparado' | 'listo_para_venta'
  | 'para_deshuesar' | 'descartado' | 'en_stock' | 'vendido' | 'sold';

export type DeviceLifecycleHistory = {
  id: string;
  occurred_at: string;
  actor_id: string;
  from_status: string | null;
  to_status: string | null;
  from_purpose: string | null;
  to_purpose: string | null;
  reason: string | null;
};

export type DeviceLifecycleSnapshot = {
  id: string;
  sku: string;
  initial_destination: DeviceDestination | null;
  operational_status: string;
  inventory_purpose: string;
  allowed_statuses: readonly DeviceLifecycleStatus[];
  history: readonly DeviceLifecycleHistory[];
};

export const lifecycleLabels: Record<DeviceLifecycleStatus, string> = {
  ingresado: 'Ingresado',
  en_evaluacion: 'En evaluación',
  en_espera: 'En espera',
  para_reparar: 'Pendiente de reacondicionar',
  en_reparacion: 'En reacondicionamiento',
  reparado: 'Reacondicionado',
  listo_para_venta: 'Listo para vender',
  para_deshuesar: 'Donante para repuestos',
  descartado: 'Descartado',
  en_stock: 'En stock (anterior)',
  vendido: 'Vendido',
  sold: 'Vendido',
};

export function lifecycleLabel(status: string): string {
  return Object.hasOwn(lifecycleLabels, status) ? lifecycleLabels[status as DeviceLifecycleStatus] : status;
}


export interface InventoryDeviceEditDto {
  brandId: string;
  deviceModelId: string;
  storageCapacityId: string | null;
  colorId: string | null;
  conditionId: string | null;
  description: string;
  serialOrImei: string;
  powersOn: DevicePowerState;
  accountLock: DeviceAccountLock;
  acquisitionSource: string;
  acquisitionCostMinor: number | null;
  currencyCode: 'UYU' | 'USD';
}

export interface InventoryDeviceListItemDto {
  brandId: string | null;
  deviceModelId: string | null;
  storageCapacityId: string | null;
  colorId: string | null;
  conditionId: string | null;
  title: string;
  description: string;
  acquisitionCostMinor: number | null;
  currencyCode: 'UYU' | 'USD';
  id: string;
  inventoryId: string;
  isDonor: boolean;
  operationalStatus: string;
  inventoryPurpose: string;
  dismantlingStatus: DismantlingStatus;
  publicListingStatus: 'draft' | 'published';
  publicValuationId: string | null;
  manufacturer: string;
  model: string;
  serialOrImei: string;
  storage: string;
  color: string;
  powersOn: DevicePowerState;
  physicalCondition: DevicePhysicalCondition;
  accountLock: DeviceAccountLock;
  acquisitionSource: string;
  acquisitionCost: string;
  destination: DeviceDestination;
  destinationTone: StatusBadgeTone;
}

// Static presentation reference data is not a persisted inventory record.
export type InventoryDeviceReferenceDto = Omit<InventoryDeviceListItemDto,
  'inventoryId' | 'isDonor' | 'operationalStatus' | 'inventoryPurpose' | 'dismantlingStatus' | 'publicListingStatus' | 'publicValuationId' | 'title' | 'description' | 'acquisitionCostMinor' | 'currencyCode' | 'brandId' | 'deviceModelId' | 'storageCapacityId' | 'colorId' | 'conditionId'>;

export interface InventoryFilterOptionDto {
  value: string;
  label: string;
}

export interface InventoryDevicesViewDto {
  title: string;
  description: string;
  breadcrumbs: readonly string[];
  newDeviceLabel: string;
  tableCaption: string;
  searchLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  columns: {
    id: string;
    device: string;
    identity: string;
    condition: string;
    source: string;
    cost: string;
    destination: string;
  };
  filters: {
    destinationLabel: string;
    allDestinationsLabel: string;
    destinationOptions: readonly InventoryFilterOptionDto[];
    conditionLabel: string;
    allConditionsLabel: string;
    conditionOptions: readonly InventoryFilterOptionDto[];
  };
  devices: readonly InventoryDeviceReferenceDto[];
}

export interface InventoryDeviceIntakeViewDto {
  title: string;
  description: string;
  breadcrumbs: readonly string[];
  introTitle: string;
  introDescription: string;
  identitySectionTitle: string;
  conditionSectionTitle: string;
  acquisitionSectionTitle: string;
  routingSectionTitle: string;
  fields: {
    brandId: string;
    deviceModelId: string;
    serialOrImei: string;
    storageCapacityId: string;
    colorId: string;
    powersOn: string;
    conditionId: string;
    accountLock: string;
    acquisitionSource: string;
    acquisitionCost: string;
    destination: string;
    notes: string;
  };
  placeholders: {
    brandId: string;
    deviceModelId: string;
    serialOrImei: string;
    storageCapacityId: string;
    colorId: string;
    conditionId: string;
    acquisitionSource: string;
    acquisitionCost: string;
    notes: string;
  };
  defaults: {
    brandId: string;
    deviceModelId: string;
    storageCapacityId: string;
    colorId: string;
    conditionId: string;
    powersOn: DevicePowerState;
    accountLock: DeviceAccountLock;
    destination: DeviceDestination;
  };
  options: {
    powersOn: readonly { value: DevicePowerState; label: string }[];
    accountLock: readonly { value: DeviceAccountLock; label: string }[];
    destination: readonly { value: DeviceDestination; label: string }[];
  };
  submitLabel: string;
  cancelLabel: string;
  localNotice: string;
  successTitle: string;
  successMessage: string;
}
