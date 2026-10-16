import { useEffect, useState, type FormEvent } from 'react';
import { adminFetch } from '@/auth/adminApiSession';
import { ModalShell } from '@/components/layout/ModalShell';
type Part = { id: string; sku: string | null; title: string; item_type: string; stock_quantity: number; currency_code?: string; consignor_id?: string | null };
type Install = { id: string; part_name: string; cost_amount_minor: number; spare_part_item_id: string | null; voided_at: string | null };
type Record = { device: { currency_code: string; cost_amount_minor: number | null; title: string }; installed_parts: Install[]; total_installed_parts_cost_minor: number };
const money = (minor: number, currency: string) => new Intl.NumberFormat('es-UY', { style: 'currency', currency: currency || 'UYU' }).format(minor / 100);
export function DeviceRepairCostsModal({ id, code, onClose, onSaved }: { id: string; code: string; onClose: () => void; onSaved: () => void }) {
  const [record, setRecord] = useState<Record | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [origin, setOrigin] = useState<'stock' | 'external'>('stock');
  const [partId, setPartId] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    const [installed, inventory] = await Promise.all([
      adminFetch('/api/v1/admin/devices/' + encodeURIComponent(id) + '/installed-parts', { cache: 'no-store' }),
      adminFetch('/api/v1/admin/inventory/items', { cache: 'no-store' }),
    ]);
    if (!installed.ok || !inventory.ok) throw new Error('No se pudieron cargar los repuestos.');
    const a = await installed.json() as { data: Record };
    const b = await inventory.json() as { data: Part[] };
    setRecord(a.data);
    setParts(b.data.filter(p => p.item_type === 'spare_part' && p.stock_quantity > 0));
  };
  useEffect(() => { let alive = true; void load().catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Error al cargar.'); }); return () => { alive = false; }; }, [id]);
  const selected = parts.find(p => p.id === partId);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !record) return;
    const amount = origin === 'stock' ? 0 : Math.round(Number(price.replace(',', '.')) * 100);
    if (origin === 'stock' && !selected) { setError('Seleccioná el repuesto del inventario.'); return; }
    if (origin === 'external' && (!Number.isSafeInteger(amount) || amount < 0)) { setError('Indicá un costo de compra válido.'); return; }
    setBusy(true); setError(null);
    try {
      const response = await adminFetch('/api/v1/admin/devices/' + encodeURIComponent(id) + '/installed-parts', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ request_id: requestId, part_name: origin === 'stock' ? selected!.title : name.trim(), cost_amount_minor: amount,
          spare_part_item_id: origin === 'stock' ? selected!.id : null, currency_code: record.device.currency_code, notes: notes.trim() || null }),
      });
      const result = await response.json().catch(() => null) as { message?: string; errors?: Record<string,string[]> } | null;
      if (!response.ok) throw new Error(result?.errors ? Object.values(result.errors).flat().join(' ') : result?.message || 'No se pudo registrar la instalación.');
      setPartId(''); setName(''); setPrice(''); setNotes(''); setRequestId(crypto.randomUUID());
      await load(); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  const currency = record?.device.currency_code || 'UYU';
  return <ModalShell title={'Reparaciones e inversiones · ' + code} density="compact" onClose={onClose} disabled={busy}>
    <div className="grid gap-3 p-3 text-xs">
      {record ? <div className="flex flex-wrap gap-3 rounded bg-slate-50 p-2">
        <span>Adquisición: <strong>{record.device.cost_amount_minor === null ? 'No registrada' : money(record.device.cost_amount_minor, currency)}</strong></span>
        <span>Inversiones: <strong>{money(record.total_installed_parts_cost_minor, currency)}</strong></span>
        <span>Total: <strong>{record.device.cost_amount_minor === null ? 'Pendiente' : money(record.device.cost_amount_minor + record.total_installed_parts_cost_minor, currency)}</strong></span>
      </div> : null}
      <form onSubmit={event => void submit(event)} className="grid gap-2">
        <div className="flex gap-3">
          <label><input type="radio" checked={origin === 'stock'} onChange={() => setOrigin('stock')} /> Desde inventario</label>
          <label><input type="radio" checked={origin === 'external'} onChange={() => setOrigin('external')} /> Compra externa</label>
        </div>
        {origin === 'stock' ? <label className="grid gap-1">Repuesto disponible
          <select required className="h-8 rounded border px-2" value={partId} onChange={e => setPartId(e.target.value)}>
            <option value="">Seleccioná un repuesto…</option>
            {parts.map(p => <option key={p.id} value={p.id}>{p.sku} · {p.title} · {p.stock_quantity} disponibles</option>)}
          </select>
          <span className="text-slate-500">Descuenta una unidad. Costo adicional imputado: 0 {currency}.</span>
        </label> : <><label className="grid gap-1">Componente adquirido
          <input required minLength={2} maxLength={255} className="h-8 rounded border px-2" value={name} onChange={e => setName(e.target.value)} />
        </label><label className="grid gap-1">Costo de compra ({currency})
          <input required inputMode="decimal" className="h-8 rounded border px-2" value={price} onChange={e => setPrice(e.target.value)} />
        </label></>}
        <label className="grid gap-1">Notas / proveedor / comprobante
          <textarea rows={2} maxLength={1000} className="rounded border p-2" value={notes} onChange={e => setNotes(e.target.value)} />
        </label>
        {error ? <p role="alert" className="rounded bg-red-50 p-2 text-red-700">{error}</p> : null}
        <div className="flex justify-end gap-2"><button className="h-8 rounded border px-3" type="button" onClick={onClose}>Cerrar</button><button disabled={!record || busy} className="h-8 rounded bg-brand-600 px-3 text-white disabled:opacity-40" type="submit">{busy ? 'Registrando…' : 'Registrar instalación'}</button></div>
      </form>
      {record ? <section className="border-t pt-2"><p className="mb-2 font-semibold">Historial de instalaciones</p>
        {record.installed_parts.length ? <div className="grid gap-1">{record.installed_parts.map(p => <div key={p.id} className="flex justify-between gap-2 border-b py-1"><span>{p.part_name}{p.voided_at ? ' (Anulada)' : ''}</span><span>{p.spare_part_item_id ? 'Inventario · ' : 'Compra · '}{money(p.cost_amount_minor, currency)}</span></div>)}</div> : <p className="text-slate-500">Sin instalaciones registradas.</p>}
      </section> : null}
    </div>
  </ModalShell>;
}
