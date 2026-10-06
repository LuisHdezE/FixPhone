import { Link } from 'react-router';
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/data-display/DataTable';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { PageShell } from '@/shell/PageShell';
import type { InventoryDemoProvider } from '../application/inventory.contracts';
import type { InventoryDeviceListItemDto } from '../application/devices.dto';

function optionLabel(options: readonly { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function InventoryDevicesPage({ provider }: { provider: InventoryDemoProvider }) {
  const view = provider.getDevicesView();

  const columns: readonly DataTableColumn<InventoryDeviceListItemDto>[] = [
    {
      id: 'id',
      header: view.columns.id,
      cell: (device) => <Link className="font-mono text-xs font-semibold text-brand-600 hover:text-brand-700" to="/apps/inventory/devices/evaluation">{device.id}</Link>,
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
      cell: (device) => optionLabel(view.filters.conditionOptions, device.physicalCondition),
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

      <div className="mt-5" data-inventory-devices>
        <DataTable
          caption={view.tableCaption}
          columns={columns}
          emptyMessage={view.emptyMessage}
          filters={filters}
          getRowId={(device) => device.id}
          initialPageSize={5}
          pageSizeOptions={[5, 10, 25]}
          rows={view.devices}
          searchLabel={view.searchLabel}
          searchPlaceholder={view.searchPlaceholder}
          searchable
          selectable
        />
      </div>
    </SurfaceCard>
  </PageShell>;
}
