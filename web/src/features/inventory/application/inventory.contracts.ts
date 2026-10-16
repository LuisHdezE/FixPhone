import type { InventoryDeviceIntakeViewDto, InventoryDevicesViewDto } from './devices.dto';
import type { InventoryDashboardDto, OperationalDashboardDto } from './inventory.dto';

export interface InventoryDevicesGateway {
  getLifecycle(inventoryId: string): Promise<import('./devices.dto').DeviceLifecycleSnapshot>;
  changeLifecycle(inventoryId: string, status: import('./devices.dto').DeviceLifecycleStatus, reason: string): Promise<void>;
  updateDevice(inventoryId: string, fields: import('./devices.dto').InventoryDeviceEditDto): Promise<void>;
  deleteDevice(inventoryId: string): Promise<void>;
  listDevices(): Promise<readonly import('./devices.dto').InventoryDeviceListItemDto[]>;
  updateDismantling(inventoryId: string, status: 'not_started' | 'partial' | 'exhausted'): Promise<void>;
  updateDestination(inventoryId: string, destination: import('./devices.dto').DeviceDestination, reason: string): Promise<void>;
}

export interface OperationalDashboardGateway {
  getDashboard(): Promise<OperationalDashboardDto>;
}

export interface InventoryDemoProvider {
  getDashboard(): InventoryDashboardDto;
  getDevicesView(): InventoryDevicesViewDto;
  getDeviceIntakeView(): InventoryDeviceIntakeViewDto;
}
