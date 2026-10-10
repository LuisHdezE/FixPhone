import { useEffect, useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/data-display/DataTable';
import { MetricCard } from '@/components/data-display/MetricCard';
import { StatusBadge, type StatusBadgeTone } from '@/components/data-display/StatusBadge';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { PageShell } from '@/shell/PageShell';
import type { DirectSaleSettlementItemDto, DirectSalesSettlementReportDto, InstalledPartsExpenseReportDto } from '../application/installedParts.dto';
import { ApiInstalledPartsGateway } from '../infrastructure/ApiInstalledPartsGateway';

const gateway = new ApiInstalledPartsGateway();

function formatMoney(amountMinor: number | null, currency = 'UYU'): string {
  if (amountMinor === null || amountMinor === undefined) return '—';
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency }).format(amountMinor / 100);
}

function statusTone(status: string): StatusBadgeTone {
  if (status === 'eligible') return 'success';
  if (status === 'pending_review') return 'warning';
  if (status === 'negative_profit') return 'warning';
  return 'neutral';
}

export function FinancialSettlementsPage() {
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeTab, setActiveTab] = useState<'settlements' | 'expenses'>('settlements');
  const [settlementsLoading, setSettlementsLoading] = useState(true);
  const [settlementsError, setSettlementsError] = useState<string | null>(null);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesError, setExpensesError] = useState<string | null>(null);
  const [settlementsReport, setSettlementsReport] = useState<DirectSalesSettlementReportDto | null>(null);
  const [expensesReport, setExpensesReport] = useState<InstalledPartsExpenseReportDto | null>(null);

  const loadData = (month: string) => {
    setSettlementsLoading(true);
    setSettlementsError(null);
    gateway.getDirectSalesSettlementsReport(month)
      .then(setSettlementsReport)
      .catch((e) => setSettlementsError(e instanceof Error ? e.message : 'Error al cargar liquidaciones.'))
      .finally(() => setSettlementsLoading(false));

    setExpensesLoading(true);
    setExpensesError(null);
    gateway.getInstalledPartsExpensesReport(month)
      .then(setExpensesReport)
      .catch((e) => setExpensesError(e instanceof Error ? e.message : 'Error al cargar gastos.'))
      .finally(() => setExpensesLoading(false));
  };

  useEffect(() => {
    loadData(yearMonth);
  }, [yearMonth]);

  const columns = useMemo<readonly DataTableColumn<DirectSaleSettlementItemDto>[]>(() => [
    {
      id: 'sku',
      header: 'ID / SKU',
      cell: (item) => <span className="font-mono text-xs font-semibold text-slate-600">{item.sku ?? item.device_id}</span>,
      sortable: true,
      sortValue: (item) => item.sku ?? item.device_id,
    },
    {
      id: 'title',
      header: 'Equipo',
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
      id: 'sale_price',
      header: 'Venta',
      align: 'right',
      cell: (item) => <span className="font-semibold text-slate-900">{formatMoney(item.sale_price_amount_minor, item.currency_code)}</span>,
      sortable: true,
      sortValue: (item) => item.sale_price_amount_minor,
    },
    {
      id: 'initial_cost',
      header: 'Costo inicial',
      align: 'right',
      cell: (item) => formatMoney(item.initial_cost_amount_minor, item.currency_code),
      sortable: true,
      sortValue: (item) => item.initial_cost_amount_minor ?? -1,
    },
    {
      id: 'parts_cost',
      header: 'Repuestos',
      align: 'right',
      cell: (item) => (
        <span className="text-amber-800">
          {formatMoney(item.installed_parts_cost_minor, item.currency_code)}
          <span className="ml-1 text-[10px] text-slate-400">({item.installed_parts_count})</span>
        </span>
      ),
      sortable: true,
      sortValue: (item) => item.installed_parts_cost_minor,
    },
    {
      id: 'settlable_profit',
      header: 'Utilidad',
      align: 'right',
      cell: (item) => {
        if (item.settlable_profit_minor === null) return <span className="text-xs text-slate-400">Pendiente</span>;
        const tone = item.settlable_profit_minor > 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-medium';
        return <span className={tone}>{formatMoney(item.settlable_profit_minor, item.currency_code)}</span>;
      },
      sortable: true,
      sortValue: (item) => item.settlable_profit_minor ?? -9999999,
    },
    {
      id: 'liquidation',
      header: 'Liquidación 50%',
      align: 'right',
      cell: (item) => (
        <span className="font-bold text-brand-700">
          {formatMoney(item.liquidation_amount_minor, item.currency_code)}
        </span>
      ),
      sortable: true,
      sortValue: (item) => item.liquidation_amount_minor,
    },
    {
      id: 'status',
      header: 'Estado',
      cell: (item) => <StatusBadge label={item.status_label} tone={statusTone(item.status)} />,
      sortable: true,
      sortValue: (item) => item.status,
    },
  ], []);

  return (
    <PageShell
      breadcrumbs={[{ label: 'Administración' }, { label: 'Liquidaciones de ventas directas' }]}
      description="Reporte financiero de repuestos instalados por equipo y liquidaciones del 50 % sobre ventas directas (Opción A oficial)."
      title="Liquidaciones 50 % y Gastos de Repuestos"
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

        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'settlements' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setActiveTab('settlements')}
            type="button"
          >
            Liquidación Ventas Directas (50%)
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'expenses' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setActiveTab('expenses')}
            type="button"
          >
            Gastos de Repuestos Instalados
          </button>
        </div>
      </div>

      {activeTab === 'settlements' && settlementsLoading && (
        <SurfaceCard>
          <p className="text-sm font-semibold text-slate-600">Calculando reporte de liquidaciones desde MySQL real...</p>
        </SurfaceCard>
      )}

      {activeTab === 'settlements' && settlementsError && (
        <SurfaceCard className="border-rose-200 bg-rose-50">
          <p className="text-sm font-semibold text-rose-800">{settlementsError}</p>
        </SurfaceCard>
      )}

      {activeTab === 'expenses' && expensesLoading && (
        <SurfaceCard>
          <p className="text-sm font-semibold text-slate-600">Calculando reporte de gastos desde MySQL real...</p>
        </SurfaceCard>
      )}

      {activeTab === 'expenses' && expensesError && (
        <SurfaceCard className="border-rose-200 bg-rose-50">
          <p className="text-sm font-semibold text-rose-800">{expensesError}</p>
        </SurfaceCard>
      )}

      {!settlementsLoading && !settlementsError && activeTab === 'settlements' && settlementsReport && (
        <>
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs text-blue-900 shadow-sm">
            <strong>Fórmula Financiera Oficial (Opción A):</strong>
            <p className="mt-1 font-mono text-xs">{settlementsReport.formula}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4">
            <MetricCard
              icon="document"
              label="Ventas directas"
              note={`${formatMoney(settlementsReport.totals.total_sales_amount_minor)} total facturado`}
              value={String(settlementsReport.totals.total_direct_sales_count)}
            />
            <MetricCard
              icon="package"
              label="Gastos en repuestos"
              note="Deducidos de utilidad"
              value={formatMoney(settlementsReport.totals.total_installed_parts_costs_minor)}
            />
            <MetricCard
              icon="store"
              label="Utilidad repartible"
              note="Venta - Costo Inicial - Repuestos"
              value={formatMoney(settlementsReport.totals.total_settlable_profit_minor)}
            />
            <MetricCard
              icon="device"
              label="Liquidación total 50%"
              note="Importe a pagar"
              value={formatMoney(settlementsReport.totals.total_liquidation_amount_minor)}
            />
          </div>

          <SurfaceCard>
            <DataTable
              caption="Detalle de liquidaciones de ventas directas"
              columns={columns}
              emptyMessage="No se registraron ventas directas en este período."
              getRowId={(item) => item.device_id}
              initialPageSize={10}
              pageSizeOptions={[10, 25, 50]}
              rows={settlementsReport.settlements}
              searchLabel="Buscar ventas"
              searchPlaceholder="SKU, equipo o estado..."
              searchable
            />
          </SurfaceCard>
        </>
      )}

      {!expensesLoading && !expensesError && activeTab === 'expenses' && expensesReport && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 mb-4">
            <MetricCard
              icon="package"
              label="Total gastos repuestos"
              note={`Período ${expensesReport.period}`}
              value={formatMoney(expensesReport.total_expenses_minor)}
            />
            <MetricCard
              icon="document"
              label="Repuestos instalados"
              note="Registros activos"
              value={String(expensesReport.total_parts_count)}
            />
            <MetricCard
              icon="device"
              label="Equipos intervenidos"
              note="Con repuestos asociados"
              value={String(expensesReport.total_devices_count)}
            />
          </div>

          <SurfaceCard>
            <h2 className="text-base font-semibold text-slate-900 mb-3">Desglose de gastos por equipo</h2>
            {expensesReport.by_device.length === 0 ? (
              <p className="text-sm text-slate-500">No se registraron instalaciones de repuestos en este período.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {expensesReport.by_device.map((device) => (
                  <div className="py-3 first:pt-0 last:pb-0" key={device.device_id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-semibold text-slate-500 mr-2">{device.sku ?? device.device_id}</span>
                        <span className="font-semibold text-slate-900">{device.title}</span>
                        <span className="text-xs text-slate-500 ml-2">({device.brand} {device.model})</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-500 mr-2">{device.parts_count} repuesto(s)</span>
                        <span className="font-bold text-amber-900">{formatMoney(device.total_parts_cost_minor, device.currency_code)}</span>
                      </div>
                    </div>

                    <div className="mt-2 space-y-1 pl-4 border-l-2 border-slate-200">
                      {device.parts.map((p) => (
                        <div className="flex items-center justify-between text-xs text-slate-600" key={p.id}>
                          <span>• {p.part_name} {p.notes ? <span className="text-slate-400">({p.notes})</span> : null}</span>
                          <span className="font-mono">{formatMoney(p.cost_amount_minor, device.currency_code)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </>
      )}
    </PageShell>
  );
}
