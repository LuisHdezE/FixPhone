import { useState, type FormEvent } from 'react';
import { ModalShell } from '@/components/layout/ModalShell';
import type {
  DeviceAccountLock,
  DevicePhysicalCondition,
  DevicePowerState,
  InventoryDeviceEditDto,
  InventoryDeviceListItemDto,
} from '../application/devices.dto';
import type { InventoryDevicesGateway } from '../application/inventory.contracts';

type Props = {
  device: InventoryDeviceListItemDto;
  gateway: InventoryDevicesGateway;
  onClose: () => void;
  onSaved: () => void;
};

function editableText(value: string): string {
  return value === '—' ? '' : value;
}

const inputClass = 'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none';
const labelClass = 'grid gap-1 text-xs font-semibold text-slate-700';

export function InventoryDeviceEditModal({ device, gateway, onClose, onSaved }: Props) {
  const [form, setForm] = useState<InventoryDeviceEditDto>({
    title: device.title,
    manufacturer: editableText(device.manufacturer === 'Sin marca' ? '' : device.manufacturer),
    model: editableText(device.model),
    description: device.description,
    serialOrImei: editableText(device.serialOrImei),
    storage: editableText(device.storage),
    color: editableText(device.color),
    physicalCondition: device.physicalCondition,
    powersOn: device.powersOn,
    accountLock: device.accountLock,
    acquisitionSource: editableText(device.acquisitionSource),
    acquisitionCostMinor: device.acquisitionCostMinor,
    currencyCode: device.currencyCode,
  });
  const [costText, setCostText] = useState(device.acquisitionCostMinor === null ? '' : (device.acquisitionCostMinor / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof InventoryDeviceEditDto>(key: K, value: InventoryDeviceEditDto[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!form.title.trim()) {
      setError('El nombre del equipo es obligatorio.');
      return;
    }
    const cost = costText.trim() === '' ? null : Number(costText.trim().replace(',', '.'));
    if (cost !== null && (!Number.isFinite(cost) || cost < 0 || !Number.isSafeInteger(Math.round(cost * 100)) || cost > 21474836.47)) {
      setError('Ingresá un costo válido en pesos o dólares, sin valores negativos.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await gateway.updateDevice(device.inventoryId, {
        ...form,
        title: form.title.trim(),
        acquisitionCostMinor: cost === null ? null : Math.round(cost * 100),
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el equipo.');
    } finally {
      setBusy(false);
    }
  }

  return <ModalShell title={'Editar dispositivo ' + device.id} disabled={busy} onClose={onClose}>
    <form className="space-y-3 p-4" onSubmit={event => void submit(event)}>
      <p className="text-xs text-slate-500">
        El código {device.id}, los movimientos, las ventas, el destino y la publicación no se modifican aquí.
        La edición se registra en auditoría.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Nombre del equipo
          <input className={inputClass} maxLength={255} required value={form.title} onChange={e => setField('title', e.target.value)} />
        </label>
        <label className={labelClass}>Marca
          <input className={inputClass} maxLength={150} value={form.manufacturer} onChange={e => setField('manufacturer', e.target.value)} />
        </label>
        <label className={labelClass}>Modelo
          <input className={inputClass} maxLength={150} value={form.model} onChange={e => setField('model', e.target.value)} />
        </label>
        <label className={labelClass}>IMEI / Serie
          <input className={inputClass} maxLength={100} value={form.serialOrImei} onChange={e => setField('serialOrImei', e.target.value)} />
        </label>
        <label className={labelClass}>Almacenamiento
          <input className={inputClass} maxLength={100} value={form.storage} onChange={e => setField('storage', e.target.value)} />
        </label>
        <label className={labelClass}>Color
          <input className={inputClass} maxLength={100} value={form.color} onChange={e => setField('color', e.target.value)} />
        </label>
        <label className={labelClass}>Condición física
          <select className={inputClass} value={form.physicalCondition} onChange={e => setField('physicalCondition', e.target.value as DevicePhysicalCondition)}>
            <option value="Unknown">Sin evaluar</option><option value="Excellent">Excelente</option>
            <option value="Good">Buena</option><option value="Fair">Regular</option>
            <option value="Poor">Mala</option><option value="Damaged">Dañado</option>
          </select>
        </label>
        <label className={labelClass}>¿Enciende?
          <select className={inputClass} value={form.powersOn} onChange={e => setField('powersOn', e.target.value as DevicePowerState)}>
            <option value="Unknown">Sin evaluar</option><option value="Yes">Sí</option><option value="No">No</option>
          </select>
        </label>
        <label className={labelClass}>Bloqueo de cuenta
          <select className={inputClass} value={form.accountLock} onChange={e => setField('accountLock', e.target.value as DeviceAccountLock)}>
            <option value="Unknown">Sin evaluar</option><option value="Clear">Libre</option><option value="Locked">Bloqueado</option>
          </select>
        </label>
        <label className={labelClass}>Origen
          <input className={inputClass} maxLength={200} value={form.acquisitionSource} onChange={e => setField('acquisitionSource', e.target.value)} />
        </label>
        <label className={labelClass}>Costo inicial
          <input className={inputClass} inputMode="decimal" placeholder="Ej. 4500,00" value={costText} onChange={e => setCostText(e.target.value)} />
        </label>
        <label className={labelClass}>Moneda
          <select className={inputClass} value={form.currencyCode} onChange={e => setField('currencyCode', e.target.value as 'UYU' | 'USD')}>
            <option value="UYU">UYU</option><option value="USD">USD</option>
          </select>
        </label>
      </div>
      <label className={labelClass}>Observaciones
        <textarea className={inputClass} rows={2} maxLength={4000} value={form.description} onChange={e => setField('description', e.target.value)} />
      </label>
      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700" role="alert">{error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold" disabled={busy} onClick={onClose} type="button">Cancelar</button>
        <button className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={busy || !form.title.trim()} type="submit">
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  </ModalShell>;
}
