import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { DonutChartCard } from '@/components/data-display/DonutChartCard';
import { FunnelChartCard } from '@/components/data-display/FunnelChartCard';
import { MetricCard } from '@/components/data-display/MetricCard';
import { StatusBadge, type StatusBadgeTone } from '@/components/data-display/StatusBadge';
import { TrendChartCard } from '@/components/data-display/TrendChartCard';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { PageShell } from '@/shell/PageShell';
import type { OperationalDashboardGateway } from '../application/inventory.contracts';
import type { OperationalDashboardDto, OperationalDashboardLatestDeviceDto } from '../application/inventory.dto';

type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; dashboard: OperationalDashboardDto };

const stockLabels: Record<keyof OperationalDashboardDto['inventory']['stock_health'], string> = {
  healthy: 'Saludable',
  reorder: 'Reponer pronto',
  out_of_stock: 'Agotado',
  available_without_minimum: 'En stock sin mínimo',
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString('es-UY') : 'Sin fecha';
}

function statusTone(status: string): StatusBadgeTone {
  if (['reparado', 'en_stock', 'published', 'publicado'].includes(status)) return 'success';
  if (['para_deshuesar', 'ingresado', 'draft', 'borrador'].includes(status)) return 'warning';
  return 'neutral';
}

function readable(value: string): string {
  return value.replaceAll('_', ' ');
}

export function InventoryDashboardPage({ gateway }: { gateway: OperationalDashboardGateway }) {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });

  useEffect(() => {
    let mounted = true;
    setState({ status: 'loading' });
    gateway.getDashboard()
      .then((dashboard) => { if (mounted) setState({ status: 'success', dashboard }); })
      .catch((error) => {
        if (mounted) setState({ status: 'error', message: error instanceof Error ? error.message : 'No se pudo cargar el panel operativo.' });
      });
    return () => { mounted = false; };
  }, [gateway]);

  const columns = useMemo<readonly DataTableColumn<OperationalDashboardLatestDeviceDto>[]>(() => [
    { id: 'sku', header: 'ID', cell: (item) => <span className="font-mono text-xs font-semibold text-slate-500">{item.sku ?? item.id}</span>, sortable: true, sortValue: (item) => item.sku ?? item.id, searchValue: (item) => item.sku ?? item.id },
    { id: 'title', header: 'Equipo', cell: (item) => <span className="font-medium text-slate-900">{item.title}</span>, sortable: true, sortValue: (item) => item.title, searchValue: (item) => item.title },
    { id: 'status', header: 'Estado', cell: (item) => <StatusBadge label={readable(item.status)} tone={statusTone(item.status)} />, sortable: true, sortValue: (item) => item.status, searchValue: (item) => item.status },
    { id: 'updated_at', header: 'Actualizado', align: 'right', cell: (item) => formatDate(item.updated_at), sortable: true, sortValue: (item) => item.updated_at ?? '', searchValue: (item) => formatDate(item.updated_at) },
  ], []);

  if (state.status === 'loading') {
    return <PageShell breadcrumbs={[{ label: 'Operación' }, { label: 'Panel operativo' }]} description="Cargando indicadores desde datos persistidos." title="Panel operativo">
      <SurfaceCard><p className="text-sm font-semibold text-slate-600">Cargando datos reales...</p></SurfaceCard>
    </PageShell>;
  }

  if (state.status === 'error') {
    return <PageShell breadcrumbs={[{ label: 'Operación' }, { label: 'Panel operativo' }]} description="No se muestran indicadores alternativos cuando el backend no responde." title="Panel operativo">
      <SurfaceCard className="border-rose-200 bg-rose-50"><p className="text-sm font-semibold text-rose-800">{state.message}</p></SurfaceCard>
    </PageShell>;
  }

  const { dashboard } = state;
  const stockEntries = Object.entries(dashboard.inventory.stock_health) as [keyof OperationalDashboardDto['inventory']['stock_health'], number][];
  const deviceStatusEntries = Object.entries(dashboard.devices.by_status);

  return <PageShell
    breadcrumbs={[{ label: 'Operación' }, { label: 'Panel operativo' }]}
    description="Indicadores calculados desde inventario, equipos, presupuestos y tasaciones persistidos. Sin datos simulados."
    title="Panel operativo"
  >
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-operational-dashboard-metrics>
      <MetricCard icon="package" label="Artículos reales" note={`${dashboard.inventory.total_units} unidades registradas`} value={String(dashboard.inventory.total_items)} />
      <MetricCard icon="device" label="Equipos" note="Teléfonos y dispositivos" value={String(dashboard.devices.total)} />
      <MetricCard icon="document" label="Presupuestos" note="Registros guardados" value={String(dashboard.repair_quotes.total)} />
      <MetricCard icon="store" label="Tasaciones" note={`${dashboard.valuations.published} publicadas`} value={String(dashboard.valuations.total)} />
    </div>

    <div className="mt-4 grid gap-3 xl:grid-cols-3">
      <SurfaceCard>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-600">Salud de stock</p>
        <div className="mt-3 grid gap-2">
          {stockEntries.map(([key, value]) => <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0" key={key}>
            <span className="text-sm text-slate-600">{stockLabels[key]}</span>
            <span className="text-sm font-semibold text-slate-950">{value}</span>
          </div>)}
        </div>
        <Link className="mt-3 inline-flex text-xs font-semibold text-brand-700 hover:text-brand-800" to="/applications/management/inventory">Ver inventario</Link>
      </SurfaceCard>

      <SurfaceCard>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-600">Estados de equipos</p>
        <div className="mt-3 grid gap-2">
          {deviceStatusEntries.length > 0 ? deviceStatusEntries.map(([status, total]) => <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0" key={status}>
            <StatusBadge label={readable(status)} tone={statusTone(status)} />
            <span className="text-sm font-semibold text-slate-950">{total}</span>
          </div>) : <p className="text-sm text-slate-500">No hay equipos reales registrados.</p>}
        </div>
        <Link className="mt-3 inline-flex text-xs font-semibold text-brand-700 hover:text-brand-800" to="/apps/inventory/devices">Ver equipos</Link>
      </SurfaceCard>

      <SurfaceCard>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-600">Reportes financieros</p>
        <div className="mt-3 grid gap-3">
          {[dashboard.reports.financial, dashboard.reports.consignment_sales].map((report) => report.status === 'active' ? (
            <Link className="block rounded-md border border-brand-200 bg-brand-50 p-3 transition-colors hover:bg-brand-100" key={report.reason} to={report.url ?? '#'}>
              <p className="text-sm font-semibold text-brand-900">{report.label}</p>
              <p className="mt-1 text-xs leading-5 text-brand-700">{report.reason}</p>
            </Link>
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3" key={report.reason}>
              <p className="text-sm font-semibold text-slate-900">{report.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{report.reason}</p>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>

    <div className="mt-4 grid gap-3 xl:grid-cols-3" data-inventory-analytics>
      <div className="xl:col-span-2">
        <TrendChartCard
          description={dashboard.analytics.trend.description}
          periodLabel={dashboard.analytics.trend.periodLabel}
          series={dashboard.analytics.trend.series}
          title={dashboard.analytics.trend.title}
        />
      </div>
      <DonutChartCard
        centerLabel={dashboard.analytics.distribution.centerLabel}
        description={dashboard.analytics.distribution.description}
        segments={dashboard.analytics.distribution.segments}
        title={dashboard.analytics.distribution.title}
      />
      <div className="xl:col-span-3">
        <FunnelChartCard
          description={dashboard.analytics.funnel.description}
          stages={dashboard.analytics.funnel.stages}
          title={dashboard.analytics.funnel.title}
        />
      </div>
    </div>

    <div className="mt-4">
      <SurfaceCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-600">Actividad reciente</p>
            <h2 className="mt-1 text-base font-semibold text-slate-950">Últimos equipos modificados</h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">Lista real desde inventario. Si no hay equipos, el panel queda vacío de forma explícita.</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">Actualizado {formatDate(dashboard.generated_at)}</span>
        </div>

        <div className="mt-3" data-operational-dashboard-latest-devices>
          <DataTable
            caption="Últimos equipos modificados"
            columns={columns}
            emptyMessage="No hay equipos reales para mostrar."
            getRowId={(item) => item.id}
            initialPageSize={5}
            pageSizeOptions={[5, 10]}
            rows={dashboard.devices.latest}
            searchLabel="Buscar equipos"
            searchPlaceholder="ID, equipo o estado..."
            searchable
          />
        </div>
      </SurfaceCard>
    </div>
  </PageShell>;
}
