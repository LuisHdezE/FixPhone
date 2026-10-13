import type { InventoryDeviceEvaluationViewDto, InventoryDeviceIntakeViewDto, InventoryDevicesViewDto } from './devices.dto';
import type { InventoryDashboardDto, OperationalDashboardDto } from './inventory.dto';

export interface InventoryDevicesGateway {
  updateDevice(inventoryId: string, fields: import('./devices.dto').InventoryDeviceEditDto): Promise<void>;
  deleteDevice(inventoryId: string): Promise<void>;
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
