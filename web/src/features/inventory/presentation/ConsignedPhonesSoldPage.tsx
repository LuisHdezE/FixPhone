import { useEffect, useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { MetricCard } from '@/components/data-display/MetricCard';
import { StatusBadge, type StatusBadgeTone } from '@/components/data-display/StatusBadge';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { PageShell } from '@/shell/PageShell';
import type { ConsignedPhoneReportItemDto, ConsignedPhonesSoldReportDto } from '../application/installedParts.dto';
import { ApiInstalledPartsGateway } from '../infrastructure/ApiInstalledPartsGateway';

const gateway = new ApiInstalledPartsGateway();

function statusTone(status: string): StatusBadgeTone {
  if (status === 'completed') return 'success';
  if (status === 'pending_conciliation') return 'warning';
  return 'neutral';
}

function readable(status: string): string {
  if (status === 'completed') return 'Completado';
  if (status === 'pending_conciliation') return 'Pendiente de Conciliación';
  return status;
}

export function ConsignedPhonesSoldPage() {
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ConsignedPhonesSoldReportDto | null>(null);

  const loadData = (month: string) => {
    setLoading(true);
    setError(null);
    gateway.getConsignedPhonesSoldReport(month)
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar reporte de consignaciones.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData(yearMonth);
  }, [yearMonth]);

  const columns = useMemo<readonly DataTableColumn<ConsignedPhoneReportItemDto>[]>(() => [
    {
      id: 'date',
      header: 'Fecha Venta',
      cell: (item) => <span className="font-semibold text-slate-900">{item.sold_at ? new Date(item.sold_at).toLocaleString('es-UY', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</span>,
      sortable: true,
      sortValue: (item) => item.sold_at ?? '',
    },
    {
      id: 'sku',
      header: 'SKU / ID',
      cell: (item) => <span className="font-mono text-xs font-semibold text-slate-600">{item.sku ?? item.device_id}</span>,
      sortable: true,
      sortValue: (item) => item.sku ?? item.device_id,
    },
    {
      id: 'title',
      header: 'Equipo (Marca/Modelo)',
      cell: (item) => (
        <div>
          <p className="font-medium text-slate-900">{item.title}</p>
          <p className="text-xs text-slate-500">{item.brand} {item.model}</p>
        </div>
      ),
      sortable: true,
      sortValue: (item) => item.title,
    },
    {
      id: 'consignor',
      header: 'Consignante',
      cell: (item) => <span className="font-medium text-slate-800">{item.consignor_name}</span>,
      sortable: true,
      sortValue: (item) => item.consignor_name,
    },
    {
      id: 'receipt',
      header: 'Folio / Comprobante',
      cell: (item) => <span className="text-sm font-semibold text-slate-600">{item.receipt_number || '—'}</span>,
      sortable: true,
      sortValue: (item) => item.receipt_number ?? '',
    },
    {
      id: 'status',
      header: 'Estado',
      cell: (item) => <StatusBadge label={readable(item.status)} tone={statusTone(item.status)} />,
      sortable: true,
      sortValue: (item) => item.status,
    },
  ], []);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isProvisional = yearMonth === currentMonth;

  return (
    <PageShell
      breadcrumbs={[{ label: 'Administración' }, { label: 'Teléfonos Consignados Vendidos' }]}
      description="Reporte de ventas de equipos de consignación, incluyendo ventas actuales y conciliaciones históricas pendientes."
      title="Teléfonos Consignados Vendidos"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600" htmlFor="yearMonthSelect">Período mensual:</label>
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none"
            id="yearMonthSelect"
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
        </div>
      </div>

      {loading && (
        <SurfaceCard>
          <p className="text-sm font-semibold text-slate-600">Cargando reporte de consignaciones...</p>
        </SurfaceCard>
      )}

      {error && (
        <SurfaceCard className="border-rose-200 bg-rose-50">
          <p className="text-sm font-semibold text-rose-800">{error}</p>
        </SurfaceCard>
      )}

      {!loading && !error && report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <MetricCard
              icon="device"
              label="Equipos Consignados Vendidos"
              note={isProvisional ? "Mes actual (Provisional)" : "Total en el mes"}
              value={String(report.totals.total_consigned_sold_count)}
            />
            {report.legacy_pending_conciliation.length > 0 && (
              <MetricCard
                icon="document"
                label="Pendientes de Conciliación"
                note="Ventas legacy sin registros"
                value={String(report.legacy_pending_conciliation.length)}
              />
            )}
          </div>

          <SurfaceCard>
            <DataTable
              caption={isProvisional ? "Detalle de ventas de consignación (Provisional)" : "Detalle de ventas de consignación"}
              columns={columns}
              emptyMessage="No hay teléfonos de consignación vendidos en este período."
              getRowId={(item) => item.sale_id ?? item.device_id}
              initialPageSize={10}
              pageSizeOptions={[10, 25, 50]}
              rows={[...report.reports, ...report.legacy_pending_conciliation]}
              searchLabel="Buscar equipos"
              searchPlaceholder="SKU, equipo, consignante o comprobante..."
              searchable
            />
          </SurfaceCard>
        </>
      )}
    </PageShell>
  );
}
