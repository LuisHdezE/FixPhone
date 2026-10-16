import { SuccessToast } from '@/components/feedback/SuccessToast';
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
import { DeviceComponentsModal } from './DeviceComponentsModal';
import { DeviceDestinationModal } from './DeviceDestinationModal';
import { PhonePublicationModal } from './PhonePublicationModal';
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
  const [canAdjust, setCanAdjust] = useState(false);
  const [extractingDevice, setExtractingDevice] = useState<InventoryDeviceListItemDto | null>(null);
  const [canValuate, setCanValuate] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [canRoute, setCanRoute] = useState(false);
  const [routingDevice, setRoutingDevice] = useState<InventoryDeviceListItemDto | null>(null);
  const [publishingPhone, setPublishingPhone] = useState<InventoryDeviceListItemDto | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<InventoryDeviceListItemDto | null>(null);
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
      setCanAdjust(permissions.includes('inventory.adjust'));
      setCanValuate(permissions.includes('valuation.manage'));
      setCanManage(permissions.includes('catalog.manage'));
      setCanRoute(permissions.includes('routing.manage'));
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

    setBusyId(device.inventoryId);
    setNotice(null);
    setActionError(null);
    try {
      await gateway.deleteDevice(device.inventoryId);
      setDeletingDevice(null);
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
      cell: (device) => device.phoneListingStatus === 'published'
        ? <Link title="Abrir teléfono en tienda" className="text-xs font-semibold text-emerald-700 underline" to={'/store/products/' + device.inventoryId} target="_blank" rel="noopener noreferrer">En tienda ↗</Link>
        : device.publicListingStatus === 'published' && device.publicValuationId
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
        {canRoute ? <button
          aria-label={'Cambiar estado o destino de ' + device.id}
          className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 disabled:opacity-40"
          disabled={busyId !== null}
          onClick={() => { setActionError(null); setRoutingDevice(device); }}
          title={'Cambiar estado o destino de ' + device.id}
          type="button"
        ><AppIcon className="size-3.5" name="map" /></button> : null}
        {canManage && device.destination === 'Direct Sale' ? <button
          aria-label={'Publicar teléfono ' + device.id}
          className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
          onClick={() => setPublishingPhone(device)} title={'Publicar en tienda ' + device.id} type="button"
        ><AppIcon className="size-3.5" name="store" /></button> : null}
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
          onClick={() => { setActionError(null); setDeletingDevice(device); }}
          title={'Eliminar ' + device.id + ' (conservar auditoría)'}
          type="button"
        ><AppIcon className="size-3.5" name="trash" /></button> : null}
        {device.isDonor && canDismantle && canAdjust ? <button aria-label={'Extraer componentes de ' + device.id} title={'Extraer componentes de ' + device.id} type="button" className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100" onClick={() => setExtractingDevice(device)}><AppIcon name="package" className="size-3.5" /></button> : null}
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

      <SuccessToast message={notice} />
      {actionError && !deletingDevice ? <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{actionError}</p> : null}

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
          ['Destino', optionLabel(view.filters.destinationOptions, activeAction.device.destination)],
          ['Despiece', activeAction.device.isDonor ? dismantlingNames[activeAction.device.dismantlingStatus] : 'No aplica'],
          ['Publicación', activeAction.device.phoneListingStatus === 'published' ? 'En tienda' : activeAction.device.publicListingStatus === 'published' ? 'Para repuestos' : 'Sin publicar'],
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
    {deletingDevice ? <ModalShell title="Eliminar dispositivo" density="compact" hideCloseButton disabled={busyId !== null} onClose={() => { if (busyId === null) { setDeletingDevice(null); setActionError(null); } }}>
      <div className="grid gap-3 p-3" data-device-delete-confirmation>
        <div className="flex items-start gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-red-50 text-red-600"><AppIcon name="trash" className="size-4" /></span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">¿Eliminar {deletingDevice.id}?</p>
            <p className="mt-0.5 break-words text-xs text-slate-600">{deletingDevice.manufacturer} {deletingDevice.model}</p>
          </div>
        </div>
        <p className="text-xs leading-5 text-slate-600">Se retirará del inventario. Su código y auditoría se conservarán. Los equipos con ventas, repuestos, tasaciones o movimientos asociados no se pueden eliminar.</p>
        {actionError ? <p role="alert" className="rounded-md bg-red-50 p-2 text-xs text-red-700">{actionError}</p> : null}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
          <button data-modal-initial-focus className="h-7 rounded-md border border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled={busyId !== null} onClick={() => { setDeletingDevice(null); setActionError(null); }} type="button">Cancelar</button>
          <button className="h-7 rounded-md bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50" disabled={busyId !== null} aria-busy={busyId !== null} onClick={() => void deleteDevice(deletingDevice)} type="button">{busyId !== null ? 'Eliminando…' : 'Eliminar'}</button>
        </div>
      </div>
    </ModalShell> : null}
    {extractingDevice ? <DeviceComponentsModal key={extractingDevice.inventoryId} device={extractingDevice} canPublish={canManage} onClose={() => setExtractingDevice(null)} onSaved={message => { setExtractingDevice(null); setNotice(message); void loadDevices(); }} /> : null}
    {publishingPhone ? <PhonePublicationModal key={publishingPhone.inventoryId} id={publishingPhone.inventoryId} onClose={() => setPublishingPhone(null)} onSaved={message => { setPublishingPhone(null); setNotice(message); void loadDevices(); }} /> : null}
    {routingDevice ? <DeviceDestinationModal
      key={routingDevice.inventoryId}
      inventoryId={routingDevice.inventoryId}
      code={routingDevice.id}
      current={routingDevice.destination}
      gateway={gateway}
      onClose={() => setRoutingDevice(null)}
      onSaved={next => {
        setRoutingDevice(null);
        setNotice('Destino del equipo actualizado a ' + optionLabel(view.filters.destinationOptions, next) + '.');
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
