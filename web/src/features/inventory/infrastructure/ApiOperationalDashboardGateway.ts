import { adminFetch } from '@/auth/adminApiSession';
import type { OperationalDashboardGateway } from '../application/inventory.contracts';
import type { OperationalDashboardDto } from '../application/inventory.dto';

async function readPayload<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message || 'No se pudo cargar el panel operativo.');
  }
  return response.json() as Promise<T>;
}

export class ApiOperationalDashboardGateway implements OperationalDashboardGateway {
  async getDashboard(): Promise<OperationalDashboardDto> {
    const payload = await readPayload<{ data: OperationalDashboardDto }>(
      await adminFetch('/api/v1/admin/dashboard/operational', { cache: 'no-store' }),
    );
    return payload.data;
  }
}
