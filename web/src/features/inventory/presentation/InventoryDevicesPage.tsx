import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AppIcon } from '@/components/AppIcon';
import { ModalShell } from '@/components/layout/ModalShell';
import { adminFetch } from '@/auth/adminApiSession';
import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/data-display/DataTable';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { InlineFeedback } from '@/components/feedback/InlineFeedback';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { PageShell } from '@/shell/PageShell';
import type { InventoryDemoProvider, InventoryDevicesGateway } from '../application/inventory.contracts';
import type { MasterDataProvider } from '@/features/master-data/application/master-data.contracts';
import { InventoryDeviceIntakeModal } from './InventoryDeviceIntakeModal';
import { DeviceLifecycleModal } from './DeviceLifecycleModal';
import { lifecycleLabel, type DismantlingStatus, type InventoryDeviceListItemDto } from '../application/devices.dto';

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
  masterDataProvider,
}: {
  provider: InventoryDemoProvider;
  gateway: InventoryDevicesGateway;
  masterDataProvider: MasterDataProvider;
}) {
  const view = provider.getDevicesView();
  const [devices, setDevices] = useState<readonly InventoryDeviceListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [canDismantle, setCanDismantle] = useState(false);
  const [canValuate, setCanValuate] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [canChangeState, setCanChangeState] = useState(false);
  const [lifecycleDevice, setLifecycleDevice] = useState<InventoryDeviceListItemDto | null>(null);
  const [editingDevice, setEditingDevice] = useState<InventoryDeviceListItemDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<{ device: InventoryDeviceListItemDto; kind: 'details' | 'dismantling' } | null>(null);

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
      setCanManage(permissions.includes('catalog.manage'));
      setCanChangeState(permissions.includes('inventory.adjust'));
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
      setActiveAction(null);
      setNotice(device.id + ': estado de despiece actualizado y auditado. La venta pública, si existía, fue despublicada.');
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'No se pudo actualizar el despiece.');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteDevice(device: InventoryDeviceListItemDto) {
    if (!canManage || busyId !== null) return;
    if (!window.confirm('¿Eliminar ' + device.id + '? Se retirará del inventario, pero su código y auditoría se conservarán. Los equipos con ventas, repuestos, tasaciones o movimientos asociados no se pueden eliminar.')) return;

    setBusyId(device.inventoryId);
    setNotice(null);
    setActionError(null);
    try {
      await gateway.deleteDevice(device.inventoryId);
      await loadDevices();
      setActiveAction(null);
      setNotice('El dispositivo ' + device.id + ' se retiró del inventario sin perder su código ni auditoría.');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'No fue posible eliminar el equipo.');
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
      cell: (device) => <div className="leading-4"><p className="font-medium text-slate-900">{device.manufacturer} {device.model}</p><p className="text-[10px] text-slate-400">{device.storage} · {device.color}</p></div>,
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
      id: 'operational',
      header: 'Estado actual',
      cell: (device) => <span className="text-xs font-semibold text-slate-700">{lifecycleLabel(device.operationalStatus)}</span>,
      sortable: true,
      sortValue: (device) => device.operationalStatus,
      searchValue: (device) => lifecycleLabel(device.operationalStatus),
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
      align: 'right',
      cell: (device) => <div className="flex items-center justify-end gap-1">
        <button
          aria-label={'Ver detalle de ' + device.id}
          className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
          onClick={() => setActiveAction({ device, kind: 'details' })}
          title={'Ver detalle de ' + device.id}
          type="button"
        ><AppIcon className="size-3.5" name="search" /></button>
        <Link
          aria-label={'Evaluar dispositivo ' + device.id}
          className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
          title={'Consultar evaluación técnica de ' + device.id}
          to={'/apps/inventory/devices/' + encodeURIComponent(device.inventoryId) + '/evaluation'}
        ><AppIcon className="size-3.5" name="check-circle" /></Link>
        <button
          aria-label={'Estado e historial de ' + device.id}
          className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 disabled:opacity-40"
          disabled={busyId !== null}
          onClick={() => setLifecycleDevice(device)}
          title={'Consultar y cambiar estado de ' + device.id}
          type="button"
        ><AppIcon className="size-3.5" name="layers" /></button>
        {canManage ? <button
          aria-label={'Editar ' + device.id}
          className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 disabled:opacity-40"
          disabled={busyId !== null}
          onClick={() => { setActionError(null); setEditingDevice(device); }}
          title={'Editar ' + device.id}
          type="button"
        ><AppIcon className="size-3.5" name="edit" /></button> : null}
        {canManage ? <button
          aria-label={'Eliminar ' + device.id}
          className="grid size-7 place-items-center rounded-md border border-slate-200 text-red-600 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-600 disabled:opacity-40"
          disabled={busyId !== null}
          onClick={() => void deleteDevice(device)}
          title={'Eliminar ' + device.id + ' (conservar auditoría)'}
          type="button"
        ><AppIcon className="size-3.5" name="trash" /></button> : null}
        {device.isDonor && canDismantle && transitions[device.dismantlingStatus].length > 1 ? <button
          aria-label={'Actualizar despiece de ' + device.id}
          className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 disabled:opacity-40"
          disabled={busyId !== null}
          onClick={() => setActiveAction({ device, kind: 'dismantling' })}
          title={'Actualizar despiece de ' + device.id}
          type="button"
        ><AppIcon className="size-3.5" name="wrench" /></button> : null}
        {device.isDonor && canValuate ? <Link
          aria-label={'Administrar ficha de ' + device.id + ' en ValuPhone'}
          className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
          title={'Administrar ficha de ' + device.id + ' en ValuPhone'}
          to="/admin/valuations"
        ><AppIcon className="size-3.5" name="tag" /></Link> : null}
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
        <button aria-label="Registrar dispositivo" className="inline-flex h-8 items-center rounded-md bg-brand-600 px-3 text-xs font-semibold text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" onClick={() => setShowIntakeModal(true)} type="button">
          Registrar
        </button>
      </div>

      {loading ? (
        <div className="mt-5">
          <InlineFeedback title="Cargando inventario" message="Consultando los dispositivos registrados en la API." tone="info" />
        </div>
      ) : null}

      {notice ? <p role="status" className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">{notice}</p> : null}
      {actionError ? <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{actionError}</p> : null}

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
            density="compact"
            initialPageSize={20}
            paginationStyle="compact"
            pageSizeOptions={[10, 20, 50]}
            rows={devices}
            searchLabel={view.searchLabel}
            searchPlaceholder={view.searchPlaceholder}
            searchable
          />
        </div>
      ) : null}
    </SurfaceCard>
    {activeAction ? <ModalShell
      disabled={busyId !== null}
      onClose={() => setActiveAction(null)}
      title={(activeAction.kind === 'details' ? 'Detalle de ' : 'Actualizar despiece de ') + activeAction.device.id}
    >
      {activeAction.kind === 'details' ? <dl className="grid gap-3 p-4 text-xs sm:grid-cols-2">
        {([
          ['Código', activeAction.device.id],
          ['Equipo', activeAction.device.manufacturer + ' ' + activeAction.device.model],
          ['IMEI / Serie', activeAction.device.serialOrImei],
          ['Memoria / Color', activeAction.device.storage + ' · ' + activeAction.device.color],
          ['Condición física', activeAction.device.physicalCondition === 'Unknown' ? 'Sin evaluar' : optionLabel(view.filters.conditionOptions, activeAction.device.physicalCondition)],
          ['Enciende', activeAction.device.powersOn],
          ['Bloqueo de cuenta', activeAction.device.accountLock],
          ['Origen', activeAction.device.acquisitionSource],
          ['Costo', activeAction.device.acquisitionCost],
          ['Destino inicial', optionLabel(view.filters.destinationOptions, activeAction.device.destination)],
          ['Estado actual', lifecycleLabel(activeAction.device.operationalStatus)],
          ['Despiece', activeAction.device.isDonor ? dismantlingNames[activeAction.device.dismantlingStatus] : 'No aplica'],
          ['Publicación', activeAction.device.publicListingStatus === 'published' ? 'Publicada' : 'Sin publicar'],
        ] as const).map(([label, value]) => <div className="min-w-0" key={label}>
          <dt className="font-semibold text-slate-500">{label}</dt>
          <dd className="mt-1 break-words font-medium text-slate-800">{value || '—'}</dd>
        </div>)}
      </dl> : <div className="space-y-3 p-4">
        <p className="text-xs text-slate-600">Elegí el nuevo estado de despiece para {activeAction.device.id}. La operación requiere confirmación y quedará auditada.</p>
        <div className="flex flex-wrap gap-2">
          {transitions[activeAction.device.dismantlingStatus]
            .filter((status): status is Exclude<DismantlingStatus, 'unknown'> => status !== 'unknown' && status !== activeAction.device.dismantlingStatus)
            .map((status) => <button
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              disabled={busyId !== null || !canDismantle}
              key={status}
              onClick={() => void updateDismantling(activeAction.device, status)}
              type="button"
            >{dismantlingNames[status]}</button>)}
        </div>
      </div>}
    </ModalShell> : null}
    {lifecycleDevice ? <DeviceLifecycleModal
      key={lifecycleDevice.inventoryId}
      device={lifecycleDevice}
      gateway={gateway}
      canManage={canChangeState}
      onClose={() => setLifecycleDevice(null)}
      onSaved={(message) => {
        setLifecycleDevice(null);
        setNotice(message);
        void loadDevices();
      }}
    /> : null}
    {editingDevice ? <InventoryDeviceIntakeModal
      key={editingDevice.inventoryId}
      editDevice={editingDevice}
      gateway={gateway}
      masterDataProvider={masterDataProvider}
      provider={provider}
      onClose={() => setEditingDevice(null)}
      onSaved={(message) => {
        setEditingDevice(null);
        setNotice(message);
        setActionError(null);
        void loadDevices();
      }}
    /> : null}
    {showIntakeModal ? (
      <InventoryDeviceIntakeModal
        masterDataProvider={masterDataProvider}
        onClose={() => setShowIntakeModal(false)}
        onCreated={(msg) => {
          setShowIntakeModal(false);
          setNotice(msg);
          void loadDevices();
        }}
        provider={provider}
      />
    ) : null}
  </PageShell>;
}
