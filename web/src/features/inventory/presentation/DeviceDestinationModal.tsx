import { useState, type FormEvent } from 'react';
import { ModalShell } from '@/components/layout/ModalShell';
import type { DeviceDestination } from '../application/devices.dto';
import type { InventoryDevicesGateway } from '../application/inventory.contracts';

const destinations: readonly { value: DeviceDestination; label: string }[] = [
  { value: 'Pending Evaluation', label: 'Pendiente de evaluación' },
  { value: 'Donor', label: 'Para repuestos' },
  { value: 'Refurbish', label: 'Reacondicionar' },
  { value: 'Direct Sale', label: 'Venta directa (tal cual)' },
  { value: 'Hold', label: 'En espera' },
  { value: 'Discard', label: 'Descartar' },
];

const controlClass = 'h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600';
const labelClass = 'grid min-w-0 gap-1 text-[11px] font-semibold text-slate-700';

export function DeviceDestinationModal({ inventoryId, code, current, gateway, onClose, onSaved }: {
  inventoryId: string;
  code: string;
  current: DeviceDestination;
  gateway: InventoryDevicesGateway;
  onClose: () => void;
  onSaved: (destination: DeviceDestination) => void;
}) {
  const [destination, setDestination] = useState<DeviceDestination>(current);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = destination !== current;
  const reasonValid = reason.trim().length >= 10;
  const canSave = changed && reasonValid && !busy;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!changed) {
      setError('Seleccioná un destino diferente del actual.');
      return;
    }
    if (!reasonValid) {
      setError('Explicá el motivo con al menos 10 caracteres.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Gateway verifies the persisted value via a fresh independent inventory GET.
      await gateway.updateDestination(inventoryId, destination, reason);
      onSaved(destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo confirmar el cambio en la base de datos.');
    } finally {
      setBusy(false);
    }
  }

  return <ModalShell density="compact" title={'Cambiar estado · ' + code} onClose={onClose} disabled={busy}>
    <form className="grid gap-2.5 p-3" onSubmit={event => void submit(event)} data-device-routing-form>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={labelClass}>Estado actual
          <input className={controlClass + ' bg-slate-50'} readOnly
            value={destinations.find(option => option.value === current)?.label ?? current}/>
        </label>
        <label className={labelClass}>Nuevo destino
          <select className={controlClass} value={destination}
            onChange={event => { setDestination(event.target.value as DeviceDestination); setError(null); }}>
            {destinations.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      {destination === 'Direct Sale' ? <p className="text-[11px] text-amber-700">Venta del equipo completo en su estado actual. No equivale a una reparación ni lo publica automáticamente. Informá los defectos al comprador.</p> : null}
      <label className={labelClass}>Motivo del cambio
        <textarea className="min-h-14 w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          placeholder="Ej.: pantalla defectuosa, pasa a repuestos"
          minLength={10} maxLength={500} rows={2} required value={reason}
          onChange={event => { setReason(event.target.value); setError(null); }}/>
      </label>
      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>Se guarda el motivo y se conserva el historial.</span>
        <span className={reasonValid ? 'text-emerald-700' : 'text-slate-500'}>{Math.min(reason.trim().length, 500)}/10 mín.</span>
      </div>
      {!changed ? <p className="text-[11px] text-amber-700">Elegí un destino diferente para habilitar el guardado.</p> : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700" role="alert">{error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
        <button className="h-8 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-40"
          type="button" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="h-8 rounded-md bg-brand-600 px-3 text-xs font-semibold text-white disabled:opacity-40"
          type="submit" disabled={!canSave}>{busy ? 'Verificando…' : 'Guardar estado'}</button>
      </div>
    </form>
  </ModalShell>;
}
