import rawDashboard from './inventory.dashboard.json';
import rawDeviceEvaluation from './inventory.device-evaluation.json';
import rawDevices from './inventory.devices.json';
import type { InventoryDemoProvider } from '../application/inventory.contracts';
import type { InventoryDeviceEvaluationViewDto, InventoryDeviceIntakeViewDto, InventoryDevicesViewDto } from '../application/devices.dto';
import type { InventoryDashboardDto } from '../application/inventory.dto';

export class JsonInventoryDemoProvider implements InventoryDemoProvider {
  getDashboard(): InventoryDashboardDto {
    const dashboard = rawDashboard as InventoryDashboardDto;
    if (!dashboard.title || !dashboard.breadcrumbs.length || !dashboard.metrics.length || !dashboard.queue.length || !dashboard.analytics?.trend.series.length || !dashboard.analytics.distribution.segments.length || !dashboard.analytics.funnel.stages.length) {
      throw new Error('Inventory dashboard reference data is incomplete.');
    }
    return dashboard;
  }

  getDevicesView(): InventoryDevicesViewDto {
    const view = rawDevices.list as InventoryDevicesViewDto;
    if (!view.title || !view.breadcrumbs.length || !view.devices.length || !view.filters.destinationOptions.length || !view.filters.conditionOptions.length) {
      throw new Error('Inventory devices reference data is incomplete.');
    }
    return view;
  }

  getDeviceIntakeView(): InventoryDeviceIntakeViewDto {
    const view = rawDevices.intake as InventoryDeviceIntakeViewDto;
    if (!view.title || !view.breadcrumbs.length || !view.options.destination.length || !view.options.powersOn.length || !view.submitLabel) {
      throw new Error('Inventory device intake reference data is incomplete.');
    }
    return view;
  }

  getDeviceEvaluationView(): InventoryDeviceEvaluationViewDto {
    const view = rawDeviceEvaluation as InventoryDeviceEvaluationViewDto;
    if (!view.title || !view.breadcrumbs.length || !view.device.id || !view.visualChecks.length || !view.functionalChecks.length || !view.decisions.length) {
      throw new Error('Inventory device evaluation reference data is incomplete.');
    }
    return view;
  }
}
