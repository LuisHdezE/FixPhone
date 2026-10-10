import type { InventoryDeviceEvaluationViewDto, InventoryDeviceIntakeViewDto, InventoryDevicesViewDto } from './devices.dto';
import type { InventoryDashboardDto, OperationalDashboardDto } from './inventory.dto';

export interface InventoryDevicesGateway {
  listDevices(): Promise<readonly import('./devices.dto').InventoryDeviceListItemDto[]>;
  updateDismantling(inventoryId: string, status: 'not_started' | 'partial' | 'exhausted'): Promise<void>;
}

export interface OperationalDashboardGateway {
  getDashboard(): Promise<OperationalDashboardDto>;
}

export interface InventoryDemoProvider {
  getDashboard(): InventoryDashboardDto;
  getDevicesView(): InventoryDevicesViewDto;
  getDeviceIntakeView(): InventoryDeviceIntakeViewDto;
  getDeviceEvaluationView(): InventoryDeviceEvaluationViewDto;
}
