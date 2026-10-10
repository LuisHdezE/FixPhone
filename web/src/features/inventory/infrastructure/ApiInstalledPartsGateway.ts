import type {
  DeviceInstalledPartDto,
  DeviceInstalledPartsListDto,
  DirectSalesSettlementReportDto,
  InstalledPartsExpenseReportDto,
} from '../application/installedParts.dto';

export class ApiInstalledPartsGateway {
  async getInstalledParts(deviceId: string): Promise<DeviceInstalledPartsListDto> {
    const res = await fetch(`/api/v1/admin/devices/${encodeURIComponent(deviceId)}/installed-parts`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'No se pudo consultar el historial de repuestos del equipo.');
    }
    const body = await res.json();
    return body.data;
  }

  async addInstalledPart(
    deviceId: string,
    payload: {
      request_id: string;
      part_name: string;
      cost_amount_minor: number;
      spare_part_item_id?: string | null;
      notes?: string | null;
    },
  ): Promise<{ part: DeviceInstalledPartDto; replayed: boolean }> {
    const res = await fetch(`/api/v1/admin/devices/${encodeURIComponent(deviceId)}/installed-parts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'No se pudo registrar el repuesto instalado.');
    }
    const body = await res.json();
    return { part: body.data, replayed: Boolean(body.replayed) };
  }

  async voidInstalledPart(deviceId: string, partId: string, reason: string): Promise<DeviceInstalledPartDto> {
    const res = await fetch(
      `/api/v1/admin/devices/${encodeURIComponent(deviceId)}/installed-parts/${encodeURIComponent(partId)}/void`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ reason }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'No se pudo anular el repuesto instalado.');
    }
    const body = await res.json();
    return body.data;
  }

  async getInstalledPartsExpensesReport(yearMonth?: string): Promise<InstalledPartsExpenseReportDto> {
    const query = yearMonth ? `?year_month=${encodeURIComponent(yearMonth)}` : '';
    const res = await fetch(`/api/v1/admin/reports/installed-parts-expenses${query}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'No se pudo cargar el reporte de gastos de repuestos.');
    }
    const body = await res.json();
    return body.data;
  }

  async getDirectSalesSettlementsReport(yearMonth?: string): Promise<DirectSalesSettlementReportDto> {
    const query = yearMonth ? `?year_month=${encodeURIComponent(yearMonth)}` : '';
    const res = await fetch(`/api/v1/admin/reports/direct-sales-settlements${query}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'No se pudo cargar el reporte de liquidaciones de ventas directas.');
    }
    const body = await res.json();
    return body.data;
  }
}
