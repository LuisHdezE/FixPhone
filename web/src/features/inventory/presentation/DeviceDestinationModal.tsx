import { useState, type FormEvent } from 'react';
import { ModalShell } from '@/components/layout/ModalShell';
import type { DeviceDestination } from '../application/devices.dto';
import type { InventoryDevicesGateway } from '../application/inventory.contracts';

const destinations: readonly { value: DeviceDestination; label: string }[] = [
  { value: 'Pending Evaluation', label: 'Pendiente de evaluación' },
  { value: 'Donor', label: 'Para repuestos / despiece' },
  { value: 'Refurbish', label: 'Reacondicionar' },
  { value: 'Hold', label: 'En espera' },
  { value: 'Discard', label: 'Descartar' },
];

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
  const canSave = destination !== current && reason.trim().length >= 10 && !busy;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await gateway.updateDestination(inventoryId, destination, reason);
      onSaved(destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el destino.');
    } finally {
      setBusy(false);
    }
  }

  return <ModalShell title={'Cambiar estado / destino · ' + code} onClose={onClose} disabled={busy}>
    <form className="grid gap-3 p-4" onSubmit={event => void submit(event)}>
      <p className="text-xs text-slate-600">
        Actualizá el destino operativo del dispositivo sin volver a registrarlo.
        Se conservarán el código FXP, el historial técnico y todos los costos.
        Esta operación no registra ventas ni movimientos de stock. Si el equipo estaba habilitado para venta, quedará deshabilitado hasta que se autorice nuevamente.
      </p>
      <label className="grid gap-1 text-xs font-semibold text-slate-800">
        Estado actual
        <input className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
          readOnly value={destinations.find(option => option.value === current)?.label ?? current} />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-800">
        Nuevo estado / destino
        <select className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          value={destination} onChange={event => setDestination(event.target.value as DeviceDestination)}>
          {destinations.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-800">
        Motivo del cambio (obligatorio)
        <textarea className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="Describí el motivo de la decisión (mínimo 10 caracteres)"
          minLength={10} maxLength={500} rows={3} required value={reason}
          onChange={event => setReason(event.target.value)}/>
      </label>
      <p className="text-xs text-amber-700">
        Si el equipo está vendido, reservado, publicado, en consignación o con despiece iniciado, el sistema impedirá cambiar su destino hasta resolver la operación correspondiente.
      </p>
      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700" role="alert">{error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" type="submit" disabled={!canSave}>
          {busy ? 'Guardando…' : 'Guardar estado'}
        </button>
      </div>
    </form>
  </ModalShell>;
}
