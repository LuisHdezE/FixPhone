import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AppIcon } from '@/components/AppIcon';
import { MetricCard } from '@/components/data-display/MetricCard';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { InlineFeedback } from '@/components/feedback/InlineFeedback';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { PageShell } from '@/shell/PageShell';
import { TechnicalEvaluationPanel } from './TechnicalEvaluationPanel';
import { DeviceDestinationModal } from './DeviceDestinationModal';
import { adminFetch } from '@/auth/adminApiSession';
import type { InventoryDeviceListItemDto, DevicePowerState, DevicePhysicalCondition, DeviceAccountLock } from '../application/devices.dto';
import type { InventoryDevicesGateway } from '../application/inventory.contracts';

const returnPath = '/apps/inventory/devices';

const physicalLabels: Record<DevicePhysicalCondition, string> = {
  Excellent: 'Excelente', Good: 'Buena', Fair: 'Regular', Poor: 'Mala',
  Damaged: 'Dañada', Unknown: 'Sin evaluar',
};

const powerLabels: Record<DevicePowerState, string> = {
  Yes: 'Sí', No: 'No', Unknown: 'Sin evaluar',
};

const lockLabels: Record<DeviceAccountLock, string> = {
  Clear: 'Sin bloqueo', Locked: 'Bloqueado', Unknown: 'Sin evaluar',
};

const destinationLabels: Record<InventoryDeviceListItemDto['destination'], string> = {
  'Pending Evaluation': 'Pendiente de evaluación',
  Donor: 'Para repuestos',
  Refurbish: 'Reacondicionar',
  Hold: 'En espera',
  Discard: 'Descartar',
};

const dismantlingLabels: Record<InventoryDeviceListItemDto['dismantlingStatus'], string> = {
  unknown: 'Sin verificar', not_started: 'Sin iniciar', partial: 'Parcial', exhausted: 'Agotado',
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const content = value && value.trim() && value !== '—' ? value : 'Sin registrar';
  return <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
    <dt className="text-[11px] font-semibold text-slate-500">{label}</dt>
    <dd className="mt-1 break-words text-sm font-medium text-slate-900">{content}</dd>
  </div>;
}

export function InventoryDeviceEvaluationPage({ gateway }: { gateway: InventoryDevicesGateway }) {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [device, setDevice] = useState<InventoryDeviceListItemDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [canRoute, setCanRoute] = useState(false);
  const [showRouting, setShowRouting] = useState(false);
  const [routingNotice, setRoutingNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setNotFound(false);
    setDevice(null);

    if (!deviceId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    gateway.listDevices()
      .then(devices => {
        if (!alive) return;
        const matching = devices.find(item => item.inventoryId === deviceId);
        if (matching) setDevice(matching);
        else setNotFound(true);
      })
      .catch(cause => {
        if (alive) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el inventario.');
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [deviceId, gateway, reloadKey]);

  useEffect(() => {
    let active = true;
    adminFetch('/api/v1/auth/me', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) return;
        const payload = await response.json() as { data?: { permissions?: string[] } };
        if (active) setCanRoute((payload.data?.permissions ?? []).includes('routing.manage'));
      }).catch(() => { if (active) setCanRoute(false); });
    return () => { active = false; };
  }, []);

  const breadcrumbs = [
    { label: 'Aplicaciones' },
    { label: 'Inventario' },
    { label: 'Dispositivos', to: returnPath },
    { label: 'Evaluación técnica' },
  ];

  return <PageShell
    title="Evaluación técnica"
    description="Ficha vinculada al dispositivo registrado en el inventario de FixPhone."
    breadcrumbs={breadcrumbs}
  >
    {loading ? <InlineFeedback title="Cargando dispositivo" message="Consultando su información actual en el inventario." tone="info" /> : null}
    {!loading && error ? <div className="grid gap-3">
      <InlineFeedback title="No se pudo cargar el dispositivo" message={error} tone="error" />
      <div className="flex gap-2">
        <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold" onClick={() => setReloadKey(key => key + 1)} type="button">Reintentar</button>
        <Link className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold" to={returnPath}>Volver a dispositivos</Link>
      </div>
    </div> : null}
    {!loading && !error && notFound ? <div className="grid gap-3">
      <InlineFeedback title="Dispositivo no encontrado" message="El equipo no existe en el inventario disponible o fue retirado. Elegí otro desde la tabla de dispositivos." tone="warning" />
      <Link className="w-fit rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold" to={returnPath}>Volver a dispositivos</Link>
    </div> : null}
    {!loading && !error && device ? <div className="grid gap-3" data-device-evaluation data-inventory-device-id={device.inventoryId}>
      <SurfaceCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-brand-600">{device.id}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">{device.manufacturer} {device.model}</h2>
            <p className="mt-1 text-xs text-slate-500">{device.storage} · {device.color}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={destinationLabels[device.destination]} tone={device.destinationTone} />
            {canRoute ? <button type="button"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setShowRouting(true)}><AppIcon name="map" className="size-3.5"/> Cambiar estado</button> : null}
            <Link className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" to={returnPath}>
              <AppIcon name="device" className="size-4" /> Volver a dispositivos
            </Link>
          </div>
        </div>
      </SurfaceCard>

      {routingNotice ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{routingNotice}</p> : null}
      {showRouting ? <DeviceDestinationModal inventoryId={device.inventoryId} code={device.id}
        current={device.destination} gateway={gateway} onClose={() => setShowRouting(false)}
        onSaved={next => {
          setShowRouting(false);
          setRoutingNotice('Estado actualizado: ' + destinationLabels[next] + '.');
          setReloadKey(key => key + 1);
        }}/> : null}
      <section className="grid gap-3 md:grid-cols-3" aria-label="Estado técnico registrado">
        <MetricCard label="Condición física" value={physicalLabels[device.physicalCondition]} tone={device.physicalCondition === 'Unknown' ? 'warning' : 'neutral'} note="Dato del inventario" />
        <MetricCard label="Encendido" value={powerLabels[device.powersOn]} tone={device.powersOn === 'Unknown' ? 'warning' : 'neutral'} note="Dato del inventario" />
        <MetricCard label="Bloqueo de cuenta" value={lockLabels[device.accountLock]} tone={device.accountLock === 'Unknown' ? 'warning' : 'neutral'} note="Dato del inventario" />
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-3">
          <SurfaceCard>
            <h3 className="text-sm font-semibold text-slate-950">Identidad y adquisición</h3>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Código FixPhone" value={device.id} />
              <Field label="IMEI / Serie" value={device.serialOrImei} />
              <Field label="Marca" value={device.manufacturer} />
              <Field label="Modelo" value={device.model} />
              <Field label="Almacenamiento" value={device.storage} />
              <Field label="Color" value={device.color} />
              <Field label="Origen" value={device.acquisitionSource} />
              <Field label="Costo inicial" value={device.acquisitionCostMinor === null ? null : device.acquisitionCost} />
              <Field label="Destino actual" value={destinationLabels[device.destination]} />
            </dl>
          </SurfaceCard>

          <TechnicalEvaluationPanel inventoryId={device.inventoryId}/>
        </div>

        <aside className="grid content-start gap-3">
          <SurfaceCard>
            <h3 className="text-sm font-semibold text-slate-950">Estado comercial y operativo</h3>
            <dl className="mt-3 grid gap-2">
              <Field label="Costo de adquisición" value={device.acquisitionCostMinor === null ? null : device.acquisitionCost} />
              <Field label="Despiece" value={device.isDonor ? dismantlingLabels[device.dismantlingStatus] : 'No aplica'} />
              <Field label="Publicación" value={device.publicListingStatus === 'published' ? 'Publicada' : 'Sin publicar'} />
              <Field label="Valor recuperable estimado" value="Sin evaluar" />
              <Field label="Costo estimado de reparación" value="Sin evaluar" />
            </dl>
            <p className="mt-3 text-xs leading-5 text-slate-500">Las estimaciones comerciales no se calculan hasta contar con valores registrados para este equipo.</p>
          </SurfaceCard>
          <SurfaceCard>
            <h3 className="text-sm font-semibold text-slate-950">Observaciones registradas</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{device.description.trim() || 'Sin observaciones registradas.'}</p>
            <p className="mt-3 text-xs leading-5 text-slate-500">Ficha de consulta. No modifica el destino ni registra una evaluación nueva.</p>
          </SurfaceCard>
        </aside>
      </div>
    </div> : null}
  </PageShell>;
}
