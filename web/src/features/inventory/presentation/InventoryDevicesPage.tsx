import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/data-display/DataTable';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { InlineFeedback } from '@/components/feedback/InlineFeedback';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { PageShell } from '@/shell/PageShell';
import type { InventoryDemoProvider, InventoryDevicesGateway } from '../application/inventory.contracts';
import type { InventoryDeviceListItemDto } from '../application/devices.dto';

function optionLabel(options: readonly { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function InventoryDevicesPage({
  provider,
  gateway,
}: {
  provider: InventoryDemoProvider;
  gateway: InventoryDevicesGateway;
}) {
  const view = provider.getDevicesView();
  const [devices, setDevices] = useState<readonly InventoryDeviceListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setDevices(await gateway.listDevices());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const columns: readonly DataTableColumn<InventoryDeviceListItemDto>[] = [
    {
      id: 'id',
      header: view.columns.id,
      cell: (device) => <span className="font-mono text-xs font-semibold text-slate-600">{device.id}</span>,
      sortable: true,
      sortValue: (device) => device.id,
      searchValue: (device) => device.id,
    },
    {
      id: 'device',
      header: view.columns.device,
      cell: (device) => <div><p className="font-medium text-slate-900">{device.manufacturer} {device.model}</p><p className="mt-0.5 text-xs text-slate-400">{device.storage} · {device.color}</p></div>,
      sortable: true,
      sortValue: (device) => `${device.manufacturer} ${device.model}`,
      searchValue: (device) => `${device.manufacturer} ${device.model} ${device.storage} ${device.color}`,
    },
    {
      id: 'identity',
      header: view.columns.identity,
      cell: (device) => <span className="font-mono text-xs text-slate-600">{device.serialOrImei}</span>,
      searchValue: (device) => device.serialOrImei,
    },
    {
      id: 'condition',
      header: view.columns.condition,
      cell: (device) => device.physicalCondition === 'Unknown' ? 'Sin evaluar' : optionLabel(view.filters.conditionOptions, device.physicalCondition),
      sortable: true,
      sortValue: (device) => device.physicalCondition,
      searchValue: (device) => device.physicalCondition,
    },
    {
      id: 'source',
      header: view.columns.source,
      cell: (device) => device.acquisitionSource,
      sortable: true,
      sortValue: (device) => device.acquisitionSource,
      searchValue: (device) => device.acquisitionSource,
    },
    {
      id: 'cost',
      header: view.columns.cost,
      align: 'right',
      cell: (device) => <span className="font-semibold text-slate-700">{device.acquisitionCost}</span>,
      searchValue: (device) => device.acquisitionCost,
    },
    {
      id: 'destination',
      header: view.columns.destination,
      cell: (device) => <StatusBadge label={optionLabel(view.filters.destinationOptions, device.destination)} tone={device.destinationTone} />,
      sortable: true,
      sortValue: (device) => device.destination,
      searchValue: (device) => device.destination,
    },
  ];

  const filters: readonly DataTableFilter<InventoryDeviceListItemDto>[] = [
    {
      id: 'destination',
      label: view.filters.destinationLabel,
      allLabel: view.filters.allDestinationsLabel,
      options: view.filters.destinationOptions,
      value: (device) => device.destination,
    },
    {
      id: 'condition',
      label: view.filters.conditionLabel,
      allLabel: view.filters.allConditionsLabel,
      options: view.filters.conditionOptions,
      value: (device) => device.physicalCondition,
    },
  ];

  return <PageShell breadcrumbs={view.breadcrumbs.map((label) => ({ label }))} description={view.description} title={view.title}>
    <SurfaceCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-sm text-slate-500">{view.description}</p>
        </div>
        <Link className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700" to="/apps/inventory/devices/new">
          {view.newDeviceLabel}
        </Link>
      </div>

      {loading ? (
        <div className="mt-5">
          <InlineFeedback title="Cargando inventario" message="Consultando los dispositivos registrados en la API." tone="info" />
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 space-y-3">
          <InlineFeedback title="No se pudo cargar el inventario" message={error} tone="error" />
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => void loadDevices()} type="button">
            Reintentar
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="mt-5" data-inventory-devices>
          <DataTable
            caption={view.tableCaption}
            columns={columns}
            emptyMessage={view.emptyMessage}
            filters={filters}
            getRowId={(device) => device.id}
            initialPageSize={5}
            pageSizeOptions={[5, 10, 25]}
            rows={devices}
            searchLabel={view.searchLabel}
            searchPlaceholder={view.searchPlaceholder}
            searchable
          />
        </div>
      ) : null}
    </SurfaceCard>
  </PageShell>;
}
