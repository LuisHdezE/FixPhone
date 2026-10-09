import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { adminToken } from '@/auth/adminApiSession';
import { PageShell } from '@/shell/PageShell';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { originalCourierUyu, partsMarkupPercent, quoteServiceRates } from '../application/repairQuote.catalog';
import type { DeviceTier, RepairQuote, RepairQuotePayload } from '../application/repairQuote.types';
import { ApiRepairQuoteGateway } from '../infrastructure/ApiRepairQuoteGateway';

type DraftService = { id: string; name: string; price: string };
type DraftPart = { id: string; name: string; price: string; qty: string };
const api = new ApiRepairQuoteGateway();
const input = 'h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[var(--theme-primary)]';
const label = 'grid gap-1 text-[11px] font-semibold text-slate-600';
const btn = 'rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50';
const uyu = (n: number) => '$' + (n / 100).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const makeKey = () => Math.random().toString(36).slice(2);

function minor(s: string): number {
  const value = s.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 1000000) {
    throw new Error('Completá los importes con números positivos y hasta dos decimales.');
  }
  return Math.round(Number(value) * 100);
}
function buildPayload(p: {
  tier: DeviceTier; customer: string; contact: string; device: string;
  services: DraftService[]; parts: DraftPart[]; courier: string; discount: string; notes: string;
}): RepairQuotePayload {
  if (!p.services.length) throw new Error('Agregá al menos un servicio.');
  const services = p.services.map((s) => ({ name: s.name, price_minor: minor(s.price) }));
  const parts = p.parts.map((x) => {
    const quantity = Number(x.qty);
    if (!x.name.trim() || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new Error('Revisá nombre y cantidad de cada repuesto.');
    }
    return { name: x.name.trim(), unit_cost_minor: minor(x.price), quantity };
  });
  const courier = minor(p.courier), discount = minor(p.discount);
  const base = parts.reduce((t, part) => t + part.quantity * part.unit_cost_minor, 0);
  const subtotal = services.reduce((t, s) => t + s.price_minor, 0)
    + Math.round(base * (100 + partsMarkupPercent) / 100) + courier;
  if (discount > subtotal) throw new Error('El descuento no puede superar el total.');
  return {
    customer_name: p.customer.trim() || null, customer_contact: p.contact.trim() || null,
    device_description: p.device.trim() || null, device_tier: p.tier,
    services, parts, courier_minor: courier, discount_minor: discount, notes: p.notes.trim() || null,
  };
}
function shareText(q: RepairQuote): string {
  return [
    'FixPhone · Presupuesto de reparación',
    'Referencia: ' + q.id.slice(-10),
    q.customer_name ? 'Cliente: ' + q.customer_name : '',
    q.device_description ? 'Equipo: ' + q.device_description : '',
    'Servicios:', ...q.services.map((s) => '• ' + s.name + ' · ' + uyu(s.price_minor)),
    q.parts.length ? 'Repuestos:' : '',
    ...q.parts.map((p) => '• ' + p.name + ' × ' + p.quantity),
    'Mano de obra: ' + uyu(q.services_subtotal_minor),
    'Repuestos (incluye recargo): ' + uyu(q.parts_total_minor),
    'Cadetería: ' + uyu(q.courier_minor),
    'Descuento: -' + uyu(q.discount_minor),
    'TOTAL: ' + uyu(q.total_minor) + ' UYU',
    'Sujeto a disponibilidad de repuestos y confirmación del diagnóstico.',
  ].filter(Boolean).join('\n');
}

export function RepairQuotesPage() {
  const [tier, setTier] = useState<DeviceTier>('media');
  const [customer, setCustomer] = useState('');
  const [contact, setContact] = useState('');
  const [device, setDevice] = useState('');
  const [services, setServices] = useState<DraftService[]>([]);
  const [parts, setParts] = useState<DraftPart[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [partName, setPartName] = useState('');
  const [partCost, setPartCost] = useState('');
  const [partQuantity, setPartQuantity] = useState('1');
  const [courier, setCourier] = useState(String(originalCourierUyu));
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [quotes, setQuotes] = useState<RepairQuote[]>([]);
  const [current, setCurrent] = useState<RepairQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const authorized = Boolean(adminToken());

  const refresh = useCallback(async () => {
    try {
      setQuotes(await api.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo consultar el historial.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { if (authorized) void refresh(); else setLoading(false); }, [authorized, refresh]);

  const payload = useMemo(() => {
    try {
      return buildPayload({ tier, customer, contact, device, services, parts, courier, discount, notes });
    } catch { return null; }
  }, [tier, customer, contact, device, services, parts, courier, discount, notes]);

  const labor = payload?.services.reduce((sum, s) => sum + s.price_minor, 0) ?? 0;
  const baseParts = payload?.parts.reduce((sum, p) => sum + p.unit_cost_minor * p.quantity, 0) ?? 0;
  const partsWithMarkup = Math.round(baseParts * (100 + partsMarkupPercent) / 100);
  const total = labor + partsWithMarkup + (payload?.courier_minor ?? 0) - (payload?.discount_minor ?? 0);

  function addService() {
    const rate = quoteServiceRates[tier].find((r) => r.id === selectedService);
    if (!rate) { setError('Seleccioná un servicio.'); return; }
    if (services.some((s) => s.name === rate.name)) { setError('Ese servicio ya fue agregado.'); return; }
    setServices((old) => [...old, { id: makeKey(), name: rate.name, price: String(rate.unitPriceUyu) }]);
    setSelectedService(''); setError('');
  }
  function addPart() {
    try {
      minor(partCost);
      const quantity = Number(partQuantity);
      if (!partName.trim() || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        throw new Error('Indicá nombre, costo y cantidad válida del repuesto.');
      }
      setParts((old) => [...old, { id: makeKey(), name: partName.trim(), price: partCost, qty: partQuantity }]);
      setPartName(''); setPartCost(''); setPartQuantity('1'); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Repuesto inválido.'); }
  }
  function clear() {
    setCustomer(''); setContact(''); setDevice(''); setServices([]); setParts([]);
    setSelectedService(''); setPartName(''); setPartCost(''); setPartQuantity('1');
    setCourier(String(originalCourierUyu)); setDiscount('0'); setNotes(''); setCurrent(null);
    setNotice(''); setError('');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const data = buildPayload({ tier, customer, contact, device, services, parts, courier, discount, notes });
      const result = await api.create(data);
      setCurrent(result);
      setNotice('Presupuesto guardado en la base de datos de FixPhone.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el presupuesto.');
    } finally { setSaving(false); }
  }
  async function copy(q: RepairQuote) {
    try {
      await navigator.clipboard.writeText(shareText(q));
      setNotice('Texto del presupuesto copiado para compartir con el cliente.');
      setError('');
    } catch { setError('No fue posible copiar automáticamente.'); }
  }

  if (!authorized) {
    return <PageShell breadcrumbs={[{ label: 'Operación' }, { label: 'Presupuestos' }]} title="Presupuestos" description="Calculadora de reparaciones FixPhone">
      <SurfaceCard><p className="text-xs text-slate-600">Ingresá con una cuenta administrativa para usar la calculadora y guardar presupuestos.</p>
        <Link className="mt-2 inline-block rounded-md bg-[var(--theme-primary)] px-3 py-2 text-xs text-white" to="/authentication/sign-in">Iniciar sesión</Link>
      </SurfaceCard>
    </PageShell>;
  }
  return <PageShell breadcrumbs={[{ label: 'Operación' }, { label: 'Presupuestos' }]} title="Presupuestos de reparación" description="Tarifas por gama, repuestos y presupuestos guardados en FixPhone.">
    <div className="grid gap-3" data-repair-quotes>
      {error ? <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p> : null}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_290px]">
        <SurfaceCard>
          <form className="grid gap-3" onSubmit={save}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Nuevo presupuesto</h2>
              <button type="button" className={btn} onClick={clear}>Limpiar</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className={label}>Cliente
                <input className={input} value={customer} maxLength={160} onChange={(e) => setCustomer(e.target.value)} />
              </label>
              <label className={label}>Contacto
                <input className={input} value={contact} maxLength={160} onChange={(e) => setContact(e.target.value)} />
              </label>
              <label className={label}>Equipo
                <input className={input} value={device} maxLength={240} placeholder="Ej.: iPhone 11" onChange={(e) => setDevice(e.target.value)} />
              </label>
              <label className={label}>Gama
                <select className={input} value={tier} onChange={(e) => { setTier(e.target.value as DeviceTier); setServices([]); setSelectedService(''); }}>
                  <option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option>
                </select>
              </label>
            </div>
            <section className="grid gap-2">
              <h3 className="text-xs font-bold">Servicios</h3>
              <div className="flex flex-wrap items-end gap-2">
                <label className={label + ' min-w-[230px] flex-1'}>Servicio
                  <select className={input} value={selectedService} onChange={(e) => setSelectedService(e.target.value)}>
                    <option value="">Seleccionar servicio</option>
                    {quoteServiceRates[tier].map((r) => <option value={r.id} key={r.id}>{r.name} · {'$'}{r.unitPriceUyu}</option>)}
                  </select>
                </label>
                <button className={btn} onClick={addService} type="button">Agregar servicio</button>
              </div>
              {tier === 'media' ? <p className="text-[11px] text-amber-700">La calculadora original indica $100 para reparación de puerto de carga en gama media. Revisá este importe.</p> : null}
              {services.length === 0 ? <p className="text-xs text-slate-500">Sin servicios agregados.</p> :
                services.map((s) => <div key={s.id} className="flex items-center gap-2 border-b border-slate-100 py-1">
                  <span className="flex-1 text-xs">{s.name}</span>
                  <input aria-label={'Precio ' + s.name} className={input + ' w-24'} type="number" min="0" max="1000000" step="0.01" value={s.price} onChange={(e) => setServices((arr) => arr.map((x) => x.id === s.id ? { ...x, price: e.target.value } : x))} />
                  <button aria-label={'Quitar ' + s.name} className={btn} type="button" onClick={() => setServices((arr) => arr.filter((x) => x.id !== s.id))}>×</button>
                </div>)}
            </section>
            <section className="grid gap-2">
              <h3 className="text-xs font-bold">Repuestos (+20 % sobre costo)</h3>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px_75px_auto]">
                <label className={label}>Nombre
                  <input className={input} placeholder="Repuesto" value={partName} onChange={(e) => setPartName(e.target.value)} />
                </label>
                <label className={label}>Costo UYU
                  <input className={input} type="number" min="0" max="1000000" step="0.01" value={partCost} onChange={(e) => setPartCost(e.target.value)} />
                </label>
                <label className={label}>Cantidad
                  <input className={input} type="number" min="1" max="100" step="1" value={partQuantity} onChange={(e) => setPartQuantity(e.target.value)} />
                </label>
                <button className={btn + ' self-end'} type="button" onClick={addPart}>Agregar</button>
              </div>
              {parts.length === 0 ? <p className="text-xs text-slate-500">Sin repuestos agregados.</p> :
                parts.map((p) => <div key={p.id} className="flex items-center gap-2 border-b border-slate-100 py-1">
                  <span className="flex-1 text-xs">{p.name}</span>
                  <span className="text-xs text-slate-600">{p.qty} × {'$'}{p.price}</span>
                  <button aria-label={'Quitar ' + p.name} className={btn} type="button" onClick={() => setParts((arr) => arr.filter((x) => x.id !== p.id))}>×</button>
                </div>)}
            </section>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className={label}>Cadetería UYU
                <input className={input} type="number" min="0" max="1000000" step="0.01" value={courier} onChange={(e) => setCourier(e.target.value)} />
              </label>
              <label className={label}>Descuento UYU
                <input className={input} type="number" min="0" max="1000000" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </label>
              <label className={label}>Notas internas
                <input className={input} value={notes} maxLength={4000} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">Tarifas originales precargadas, editables en cada presupuesto. El historial conserva valores anteriores.</p>
            <button type="submit" disabled={saving || !payload} className="w-fit rounded-md bg-[var(--theme-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar presupuesto'}
            </button>
          </form>
        </SurfaceCard>
        <div className="grid content-start gap-3">
          <SurfaceCard>
            <h2 className="mb-3 text-sm font-bold">Total calculado</h2>
            {payload ? <div className="grid gap-2 text-xs">
              <div className="flex justify-between"><span>Servicios</span><strong>{uyu(labor)}</strong></div>
              <div className="flex justify-between"><span>Repuestos costo</span><span>{uyu(baseParts)}</span></div>
              <div className="flex justify-between"><span>Repuestos +20 %</span><strong>{uyu(partsWithMarkup)}</strong></div>
              <div className="flex justify-between"><span>Cadetería</span><span>{uyu(payload.courier_minor)}</span></div>
              <div className="flex justify-between"><span>Descuento</span><span>−{uyu(payload.discount_minor)}</span></div>
              <div className="flex justify-between border-t pt-2 text-base"><strong>Total UYU</strong><strong>{uyu(total)}</strong></div>
              <p className="text-[11px] text-slate-500">Laravel volverá a calcular el total al guardar.</p>
            </div> : <p className="text-xs text-slate-500">Agregá servicios e importes válidos para calcular.</p>}
          </SurfaceCard>
          {current ? <SurfaceCard>
            <h2 className="text-sm font-bold">Presupuesto guardado</h2>
            <p className="mt-1 text-xs text-slate-500">Ref. {current.id.slice(-10)}</p>
            <p className="my-2 text-xl font-bold">{uyu(current.total_minor)}</p>
            <button className={btn} type="button" onClick={() => void copy(current)}>Copiar para el cliente</button>
            <p className="mt-2 text-[11px] text-slate-500">El texto compartido no incluye costos internos ni teléfono privado del cliente.</p>
          </SurfaceCard> : null}
        </div>
      </div>
      <SurfaceCard>
        <h2 className="mb-3 text-sm font-bold">Historial de presupuestos</h2>
        {loading ? <p className="text-xs">Cargando…</p> : quotes.length === 0 ? <p className="text-xs text-slate-500">Todavía no hay presupuestos guardados.</p> :
          <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs">
            <thead><tr className="border-b text-slate-500"><th className="p-2">Ref.</th><th className="p-2">Cliente</th><th className="p-2">Equipo</th><th className="p-2">Gama</th><th className="p-2">Total</th><th className="p-2">Acción</th></tr></thead>
            <tbody>{quotes.map((q) => <tr className="border-b border-slate-100" key={q.id}>
              <td className="p-2 font-mono">{q.id.slice(-10)}</td><td className="p-2">{q.customer_name || '—'}</td>
              <td className="p-2">{q.device_description || '—'}</td><td className="p-2 capitalize">{q.device_tier}</td>
              <td className="p-2 font-semibold">{uyu(q.total_minor)}</td>
              <td className="p-2"><button type="button" className="text-[var(--theme-primary)]" onClick={() => { setCurrent(q); setNotice('Presupuesto histórico seleccionado.'); }}>Ver / copiar</button></td>
            </tr>)}</tbody>
          </table></div>}
        <p className="mt-2 text-[11px] text-slate-500">Los presupuestos guardados no se modifican. Si cambia una tarifa, generá una nueva cotización.</p>
      </SurfaceCard>
    </div>
  </PageShell>;
}
