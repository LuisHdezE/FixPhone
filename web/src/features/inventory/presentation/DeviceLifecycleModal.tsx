import { useEffect, useState, type FormEvent } from 'react';
import { ModalShell } from '@/components/layout/ModalShell';
import type { InventoryDevicesGateway } from '../application/inventory.contracts';
import {
  lifecycleLabel,
  type DeviceLifecycleSnapshot,
  type DeviceLifecycleStatus,
  type InventoryDeviceListItemDto,
} from '../application/devices.dto';

type Props = {
  device: InventoryDeviceListItemDto;
  gateway: InventoryDevicesGateway;
  canManage: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
};

export function DeviceLifecycleModal({ device, gateway, canManage, onClose, onSaved }: Props) {
  const [snapshot, setSnapshot] = useState<DeviceLifecycleSnapshot | null>(null);
  const [choice, setChoice] = useState<DeviceLifecycleStatus | ''>('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    gateway.getLifecycle(device.inventoryId)
      .then(data => {
        if (active) {
          setSnapshot(data);
          setChoice('');
        }
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el estado del equipo.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [device.inventoryId, gateway]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !choice || reason.trim().length < 10 || busy) return;
    const label = lifecycleLabel(choice);
    if (!window.confirm('¿Confirmás cambiar ' + device.id + ' a «' + label + '»? El destino y la titularidad permanecerán intactos.')) return;
    setBusy(true);
    setError(null);
    try {
      await gateway.changeLifecycle(device.inventoryId, choice, reason.trim());
      onSaved(device.id + ': nuevo estado «' + label + '» registrado con auditoría.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado.');
      // Reload options so stale transitions are not accidentally reused.
      try {
        const latest = await gateway.getLifecycle(device.inventoryId);
        setSnapshot(latest);
        setChoice('');
      } catch {
        setSnapshot(null);
      }
    } finally {
      setBusy(false);
    }
  }

  return <ModalShell title={'Estado e historial · ' + device.id} onClose={onClose} disabled={busy} density="compact">
    <div className="grid gap-3 p-4 text-sm">
      {loading ? <p className="text-xs text-slate-500">Consultando estados permitidos e historial…</p> : null}
      {snapshot ? <>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">Destino actual</p>
            <p className="mt-1 font-semibold text-slate-900">{snapshot.current_destination ?? 'Sin destino registrado'}</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">Estado operativo actual</p>
            <p className="mt-1 font-semibold text-slate-900">{lifecycleLabel(snapshot.operational_status)}</p>
          </div>
        </div>
        <p className="text-xs text-slate-600">El progreso de taller queda registrado con trazabilidad. Para cambiar el destino usá la acción de enrutamiento. Esta acción nunca habilita ventas, publica productos ni altera existencias.</p>
        {canManage && snapshot.allowed_statuses.length > 0 ? <form className="grid gap-3" onSubmit={event => void save(event)}>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Nuevo estado
            <select className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm" required
              value={choice} onChange={event => setChoice(event.target.value as DeviceLifecycleStatus | '')}>
              <option value="">Elegí una transición permitida</option>
              {snapshot.allowed_statuses.map(status => <option key={status} value={status}>{lifecycleLabel(status)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-700">
            Motivo del cambio (obligatorio)
            <textarea className="rounded-md border border-slate-300 px-2.5 py-2 text-sm" rows={2} maxLength={500} minLength={10}
              placeholder="Explicá por qué cambia el estado de este equipo…" required value={reason}
              onChange={event => setReason(event.target.value)}/>
          </label>
          <div className="flex justify-end">
            <button className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" type="submit"
              disabled={busy || !choice || reason.trim().length < 10}>{busy ? 'Guardando…' : 'Confirmar cambio de estado'}</button>
          </div>
        </form> : <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
          {canManage ? 'No hay transiciones habilitadas. Puede existir una venta, una reserva, una publicación o un despiece irreversible.' : 'Tu perfil permite consultar, pero no modificar el estado de este equipo.'}
        </p>}
        <section aria-label="Historial de estados" className="border-t border-slate-200 pt-3">
          <h3 className="text-sm font-semibold text-slate-900">Historial de cambios operativos</h3>
          {snapshot.history.length === 0 ? <p className="mt-2 text-xs text-slate-500">No hay cambios posteriores al ingreso registrados.</p> : null}
          <ol className="mt-2 grid max-h-64 gap-2 overflow-y-auto">
            {snapshot.history.map(event => <li key={event.id} className="rounded-md border border-slate-200 p-2.5 text-xs">
              <p className="font-semibold text-slate-900">
                {event.from_status ? lifecycleLabel(event.from_status) : 'Sin estado anterior'} → {event.to_status ? lifecycleLabel(event.to_status) : 'Sin estado'}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{event.reason ?? 'Sin motivo registrado'}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {new Date(event.occurred_at).toLocaleString('es-UY')} · Operador {event.actor_id}
              </p>
            </li>)}
          </ol>
        </section>
      </> : null}
      {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}
      <div className="flex justify-end border-t border-slate-100 pt-2">
        <button className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700" disabled={busy} onClick={onClose} type="button">Cerrar</button>
      </div>
    </div>
  </ModalShell>;
}
