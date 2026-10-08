import type { StatusBadgeTone } from '@/components/data-display/StatusBadge';

export type DeviceDestination = 'Pending Evaluation' | 'Donor' | 'Refurbish' | 'Hold' | 'Discard';
export type DevicePhysicalCondition = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Damaged' | 'Unknown';
export type DevicePowerState = 'Yes' | 'No' | 'Unknown';
export type DeviceAccountLock = 'Clear' | 'Locked' | 'Unknown';

export interface InventoryDeviceListItemDto {
  id: string;
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
  devices: readonly InventoryDeviceListItemDto[];
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

export interface DeviceEvaluationCheckDto {
  id: string;
  label: string;
  value: string;
  tone: StatusBadgeTone;
}

export interface DeviceEvaluationMetricDto {
  id: string;
  label: string;
  value: string;
  note: string;
  tone: 'success' | 'warning' | 'info' | 'neutral';
}

export interface DeviceEvaluationDecisionDto {
  destination: DeviceDestination;
  label: string;
  description: string;
  tone: StatusBadgeTone;
}

export interface InventoryDeviceEvaluationViewDto {
  title: string;
  description: string;
  breadcrumbs: readonly string[];
  backLabel: string;
  device: InventoryDeviceListItemDto;
  summaryTitle: string;
  metrics: readonly DeviceEvaluationMetricDto[];
  identitySectionTitle: string;
  visualSectionTitle: string;
  functionalSectionTitle: string;
  commercialSectionTitle: string;
  decisionSectionTitle: string;
  fields: {
    acquisitionSource: string;
    acquisitionCost: string;
    serialOrImei: string;
    accountLock: string;
    physicalCondition: string;
    powersOn: string;
    estimatedRecoverableValue: string;
    estimatedPartsValue: string;
    estimatedRefurbCost: string;
    recommendedDestination: string;
    evaluatorNotes: string;
  };
  visualChecks: readonly DeviceEvaluationCheckDto[];
  functionalChecks: readonly DeviceEvaluationCheckDto[];
  commercial: {
    estimatedRecoverableValue: string;
    estimatedPartsValue: string;
    estimatedRefurbCost: string;
    profitabilitySignal: string;
  };
  decisions: readonly DeviceEvaluationDecisionDto[];
  recommendedDestination: DeviceDestination;
  evaluatorNotes: string;
  localNotice: string;
  submitLabel: string;
  successTitle: string;
  successMessage: string;
}
