import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/data-display/DataTable';
import { DonutChartCard } from '@/components/data-display/DonutChartCard';
import { FunnelChartCard } from '@/components/data-display/FunnelChartCard';
import { MetricCard } from '@/components/data-display/MetricCard';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { TrendChartCard } from '@/components/data-display/TrendChartCard';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { PageShell } from '@/shell/PageShell';
import type { InventoryDemoProvider } from '../application/inventory.contracts';
import type { InventoryDashboardDto, InventoryQueueItemDto } from '../application/inventory.dto';

function filterLabel(filter: { options: readonly { value: string; label: string }[] }, value: string) {
  return filter.options.find((option) => option.value === value)?.label ?? value;
}

function buildQueueColumns(filters: InventoryDashboardDto['queueFilters']): readonly DataTableColumn<InventoryQueueItemDto>[] {
  const statusFilter = filters.find((filter) => filter.id === 'status');
  const priorityFilter = filters.find((filter) => filter.id === 'priority');

  return [
  { id: 'id', header: 'ID', cell: (item) => <span className="font-mono text-xs font-semibold text-slate-500">{item.id}</span>, sortable: true, sortValue: (item) => item.id, searchValue: (item) => item.id },
  { id: 'device', header: 'Dispositivo', cell: (item) => <span className="font-medium text-slate-900">{item.deviceLabel}</span>, sortable: true, sortValue: (item) => item.deviceLabel, searchValue: (item) => item.deviceLabel },
  { id: 'context', header: 'Contexto', cell: (item) => item.context, searchValue: (item) => item.context },
  { id: 'status', header: 'Estado', cell: (item) => <StatusBadge label={statusFilter ? filterLabel(statusFilter, item.status) : item.status} tone={item.statusTone} />, sortable: true, sortValue: (item) => item.status, searchValue: (item) => `${item.status} ${statusFilter ? filterLabel(statusFilter, item.status) : ''}` },
  { id: 'priority', header: 'Prioridad', cell: (item) => priorityFilter ? filterLabel(priorityFilter, item.priority) : item.priority, sortable: true, sortValue: (item) => item.priority, searchValue: (item) => `${item.priority} ${priorityFilter ? filterLabel(priorityFilter, item.priority) : ''}` },
  { id: 'action', header: 'Próxima acción', align: 'right', cell: (item) => <span className="font-semibold text-brand-600">{item.actionLabel}</span>, searchValue: (item) => item.actionLabel },
  ];
}

export function InventoryDashboardPage({ provider }: { provider: InventoryDemoProvider }) {
  const dashboard = provider.getDashboard();
  const queueColumns = buildQueueColumns(dashboard.queueFilters);

  return <PageShell breadcrumbs={dashboard.breadcrumbs.map((label) => ({ label }))} description={dashboard.description} title={dashboard.title}>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-inventory-metrics>
      {dashboard.metrics.map((metric) => <MetricCard icon={metric.icon} key={metric.id} label={metric.label} note={metric.note} tone={metric.tone} value={String(metric.value)} />)}
    </div>

    <div className="mt-6 grid gap-4 xl:grid-cols-3" data-inventory-analytics>
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

    <div className="mt-6">
      <SurfaceCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-600">Cola operacional</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">{dashboard.attentionTitle}</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">{dashboard.attentionDescription}</p>
          </div>
        </div>

        <div className="mt-5" data-inventory-queue>
          <DataTable
            caption="Cola operacional de inventario"
            columns={queueColumns}
            filters={dashboard.queueFilters.map((filter): DataTableFilter<InventoryQueueItemDto> => ({ ...filter, value: (item) => String(item[filter.id]) }))}
            getRowId={(item) => item.id}
            initialPageSize={5}
            pageSizeOptions={[5, 10, 25]}
            rows={dashboard.queue}
            searchLabel="Buscar en la cola"
            searchPlaceholder="ID, dispositivo, estado o acción…"
            searchable
          />
        </div>
      </SurfaceCard>
    </div>
  </PageShell>;
}
