import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { adminFetch } from '@/auth/adminApiSession';
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/data-display/DataTable';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { InlineFeedback } from '@/components/feedback/InlineFeedback';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { PageShell } from '@/shell/PageShell';
import type { InventoryDemoProvider, InventoryDevicesGateway } from '../application/inventory.contracts';
import type { DismantlingStatus, InventoryDeviceListItemDto } from '../application/devices.dto';

const dismantlingNames: Record<DismantlingStatus, string> = {
  unknown: 'Sin verificar',
  not_started: 'Sin iniciar',
  partial: 'Parcial',
  exhausted: 'Agotado',
};

const transitions: Record<DismantlingStatus, readonly DismantlingStatus[]> = {
  unknown: ['unknown', 'not_started', 'partial', 'exhausted'],
  not_started: ['not_started', 'partial', 'exhausted'],
  partial: ['partial', 'exhausted'],
  exhausted: ['exhausted'],
};

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
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [canDismantle, setCanDismantle] = useState(false);
  const [canValuate, setCanValuate] = useState(false);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [items, identity] = await Promise.all([
        gateway.listDevices(),
        adminFetch('/api/v1/auth/me', { cache: 'no-store' }),
      ]);
      if (!identity.ok) throw new Error('No se pudieron verificar los permisos de tu cuenta.');
      const payload = await identity.json() as { data?: { permissions?: string[] } };
      const permissions = Array.isArray(payload.data?.permissions) ? payload.data.permissions : [];
      setCanDismantle(permissions.includes('workshop.dismantle'));
      setCanValuate(permissions.includes('valuation.manage'));
      setDevices(items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  async function updateDismantling(device: InventoryDeviceListItemDto, next: Exclude<DismantlingStatus, 'unknown'>) {
    if (!canDismantle || !device.isDonor || busyId !== null || device.dismantlingStatus === next) return;
    const message = next === 'not_started'
      ? '¿Confirmás que este equipo todavía no ha sido desarmado?'
      : '¿Confirmás el estado «' + dismantlingNames[next] + '»? Se ocultará la publicación individual existente y no se podrá revertir automáticamente. El stock no cambiará en esta fase.';
    if (!window.confirm(message)) return;

    setBusyId(device.inventoryId);
    setError(null);
    setNotice(null);
    try {
      await gateway.updateDismantling(device.inventoryId, next);
      await loadDevices();
      setNotice(device.id + ': estado de despiece actualizado y auditado. La venta pública, si existía, fue despublicada.');
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'No se pudo actualizar el despiece.');
    } finally {
      setBusyId(null);
    }
  }

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
    {
      id: 'dismantling',
      header: 'Despiece',
      cell: (device) => device.isDonor
        ? <StatusBadge label={dismantlingNames[device.dismantlingStatus]} tone={device.dismantlingStatus === 'exhausted' ? 'warning' : device.dismantlingStatus === 'partial' ? 'info' : 'neutral'} />
        : <span className="text-slate-400">No aplica</span>,
      sortable: true,
      sortValue: (device) => device.isDonor ? device.dismantlingStatus : 'not_applicable',
      searchValue: (device) => device.isDonor ? dismantlingNames[device.dismantlingStatus] : '',
    },
    {
      id: 'visibility',
      header: 'Publicación',
      cell: (device) => device.publicListingStatus === 'published' && device.publicValuationId
        ? <Link title="Abrir ficha pública" className="text-xs font-semibold text-emerald-700 underline" to={'/store/for-parts/' + device.publicValuationId} target="_blank" rel="noopener noreferrer">Publicada ↗</Link>
        : <span className="text-xs text-slate-500">Sin publicar</span>,
      searchValue: (device) => device.publicListingStatus,
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: (device) => <div className="flex flex-wrap items-center gap-1.5">
        {device.isDonor && canDismantle && transitions[device.dismantlingStatus].length > 1 ? <select
          aria-label={'Actualizar despiece de ' + device.id}
          title="Registrar estado de despiece (sin movimientos de stock)"
          className="max-w-36 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
          disabled={busyId !== null}
          value={device.dismantlingStatus}
          onChange={(event) => {
            const next = event.target.value as Exclude<DismantlingStatus, 'unknown'>;
            // Reset the native select while confirmation/API validation is pending.
            event.currentTarget.value = device.dismantlingStatus;
            void updateDismantling(device, next);
          }}
        >
          {transitions[device.dismantlingStatus].map((status) => <option key={status} value={status}>{dismantlingNames[status]}</option>)}
        </select> : null}
        {device.isDonor && canValuate ? <Link
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          title={'Administrar ficha pública de ' + device.id + ' en ValuPhone'}
          to="/admin/valuations"
        >ValuPhone ↗</Link> : null}
        {!device.isDonor || (!canDismantle && !canValuate) ? <span className="text-xs text-slate-400">Sin acciones</span> : null}
      </div>,
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

      {notice ? <p role="status" className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">{notice}</p> : null}

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
            initialPageSize={10}
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
