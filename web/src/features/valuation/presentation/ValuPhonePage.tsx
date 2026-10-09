import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { adminFetch, adminToken } from '@/auth/adminApiSession';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import { PageShell } from '@/shell/PageShell';
import { ApiValuationGateway } from '../infrastructure/ApiValuationGateway';
import type { DeviceValuation, FaultType, PublicationStatus, ScreenCondition, PowerState, ValuationPayload } from '../application/valuation.types';

type Form = {
  model: string; inventoryId: string; fault: FaultType; screen: ScreenCondition; power: PowerState;
  low: string; high: string; asking: string; minimum: string; status: PublicationStatus;
  source: string; notes: string; ad: string; postUrl: string;
};
type DeviceOption = { id: string; sku?: string; model?: string; title: string };
const gateway = new ApiValuationGateway();
const initial: Form = {
  model: 'iPhone 11', inventoryId: '', fault: 'icloud', screen: 'unknown', power: 'unknown',
  low: '', high: '', asking: '', minimum: '', status: 'draft',
  source: '', notes: '', ad: '', postUrl: '',
};
const iphoneModels = [
  'iPhone 6', 'iPhone 6 Plus', 'iPhone 6s', 'iPhone 6s Plus', 'iPhone SE (1.ª gen.)',
  'iPhone 7', 'iPhone 7 Plus', 'iPhone 8', 'iPhone 8 Plus', 'iPhone X',
  'iPhone XR', 'iPhone XS', 'iPhone XS Max', 'iPhone SE (2.ª gen.)',
  'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
  'iPhone 12 mini', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max',
  'iPhone 13 mini', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max', 'iPhone SE (3.ª gen.)',
  'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
  'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
  'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max', 'iPhone 16e',
  'iPhone 17', 'iPhone 17 Pro', 'iPhone 17 Pro Max', 'iPhone Air',
];
const icloudEstimates: Record<string, readonly [number, number]> = {
  'iPhone 7': [1000, 1700], 'iPhone 7 Plus': [1300, 2000],
  'iPhone 8': [1200, 1800], 'iPhone 8 Plus': [1700, 2500],
  'iPhone X': [2000, 2800], 'iPhone XR': [2300, 3200],
  'iPhone XS': [2300, 3200], 'iPhone XS Max': [2800, 3900],
  'iPhone 11': [2800, 4000], 'iPhone 11 Pro': [2700, 4000],
  'iPhone 11 Pro Max': [3500, 4800], 'iPhone 12 mini': [2500, 3500],
  'iPhone 12': [3200, 4500],
};
const faults: Record<FaultType, string> = {
  icloud: 'Bloqueo de activación iCloud', no_signal: 'Sin señal', board: 'Falla de placa', other: 'Otra falla',
};
const statuses: Record<PublicationStatus, string> = {
  draft: 'Borrador', published: 'Publicado', closed: 'Cerrado',
};
const input = 'h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-[var(--theme-primary)]';
const label = 'grid gap-1 text-[11px] font-semibold text-slate-600';
const cash = (minor: number | null) => minor === null ? '' : String(minor / 100);
const displayCash = (minor: number | null) => minor === null ? 'Sin definir' : '$' + (minor / 100).toLocaleString('es-UY');
function toMinor(raw: string): number | null {
  if (!raw.trim()) return null;
  const amount = Number(raw.replace(',', '.'));
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Los importes deben ser números positivos.');
  return Math.round(amount * 100);
}
function fromRow(row: DeviceValuation): Form {
  return {
    model: row.model_name, inventoryId: row.inventory_item_id ?? '',
    fault: row.fault_type, screen: row.screen_condition, power: row.power_state,
    low: cash(row.estimated_min_minor), high: cash(row.estimated_max_minor),
    asking: cash(row.asking_price_minor), minimum: cash(row.minimum_price_minor),
    status: row.publication_status, source: row.market_reference ?? '',
    notes: row.notes ?? '', ad: row.facebook_copy ?? '', postUrl: row.facebook_post_url ?? '',
  };
}
function payload(f: Form): ValuationPayload {
  return {
    inventory_item_id: f.inventoryId || null, model_name: f.model.trim(), fault_type: f.fault,
    screen_condition: f.screen, power_state: f.power,
    estimated_min_minor: toMinor(f.low), estimated_max_minor: toMinor(f.high),
    asking_price_minor: toMinor(f.asking), minimum_price_minor: toMinor(f.minimum),
    publication_status: f.status, market_reference: f.source.trim() || null,
    notes: f.notes.trim() || null, facebook_copy: f.ad.trim() || null,
    facebook_post_url: f.postUrl.trim() || null,
  };
}
function createAd(f: Form): string {
  const screen = f.screen === 'good' ? 'Pantalla en buen estado.' :
    f.screen === 'damaged' ? 'Pantalla dañada.' : 'Estado de pantalla sin verificar.';
  const powered = f.power === 'yes' ? 'Enciende.' : f.power === 'no' ? 'No enciende.' : 'Encendido sin verificar.';
  return '📱 ' + f.model.trim() + ' | FixPhone\n' +
    'Se vende PARA REPUESTOS. ' + faults[f.fault] + '.\n' + screen + ' ' + powered + '\n' +
    (f.notes.trim() ? f.notes.trim() + '\n' : '') +
    (f.asking.trim() ? 'Precio: $' + f.asking.trim() + ' UYU.\n' : '') +
    '⚠️ Equipo vendido en el estado indicado. No se promete desbloqueo ni funcionamiento como teléfono.\n' +
    'Consultá por privado y seguí FixPhone en Facebook para conocer nuestros repuestos y equipos reacondicionados.';
}

export function ValuPhonePage() {
  const [items, setItems] = useState<DeviceValuation[]>([]);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [form, setForm] = useState<Form>(initial);
  const [id, setId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasSession = Boolean(adminToken());
  const reference = form.fault === 'icloud' && form.screen === 'good' ? icloudEstimates[form.model] : undefined;

  const load = useCallback(async () => {
    try {
      const [saved, result] = await Promise.all([
        gateway.list(),
        adminFetch('/api/v1/admin/inventory'),
      ]);
      setItems(saved);
      if (result.ok) setDevices(((await result.json()) as { data: DeviceOption[] }).data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Error al cargar fichas.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { if (hasSession) void load(); else setLoading(false); }, [hasSession, load]);

  function change<K extends keyof Form>(field: K, value: Form[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setNotice('');
  }
  function edit(item: DeviceValuation) {
    setId(item.id);
    setForm(fromRow(item));
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.model.trim()) { setError('Debés indicar el modelo.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await gateway.save(payload(form), id || undefined);
      setId(saved.id); setForm(fromRow(saved));
      setNotice('Ficha guardada en la base de datos de FixPhone.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }
  if (!hasSession) {
    return <PageShell breadcrumbs={[{ label: 'Operación' }, { label: 'ValuPhone' }]} title="ValuPhone" description="Valoraciones individuales para FixPhone.">
      <SurfaceCard><p className="text-xs">Esta herramienta requiere una sesión administrativa autorizada.</p>
        <Link className="mt-2 inline-block rounded-md bg-[var(--theme-primary)] px-3 py-2 text-xs text-white" to="/authentication/sign-in" state={{ from: '/admin/valuations' }}>Iniciar sesión</Link>
      </SurfaceCard>
    </PageShell>;
  }

  return <PageShell breadcrumbs={[{ label: 'Operación' }, { label: 'ValuPhone' }]} title="ValuPhone" description="Valorar un teléfono por vez y preparar anuncios de FixPhone para Facebook.">
    <div className="grid gap-3" data-valuations>
      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800" role="alert">{error}</p> : null}
      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800" role="status">{notice}</p> : null}
      <SurfaceCard>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{id ? 'Editar valoración' : 'Nueva valoración'}</h2>
          <button className="rounded-md border px-2 py-1 text-xs" type="button" onClick={() => { setId(null); setForm(initial); setNotice(''); }}>Nueva ficha</button>
        </div>
        <form onSubmit={save}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className={label}>Equipo ya registrado en inventario (opcional)
              <select className={input} value={form.inventoryId} onChange={(e) => {
                const device = devices.find((value) => value.id === e.target.value);
                setForm((current) => ({ ...current, inventoryId: e.target.value, model: device?.model || current.model }));
              }}>
                <option value="">No vinculado: valorar sin crear inventario</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.sku || d.id.slice(0, 8)} · {d.model || d.title}</option>)}
              </select>
            </label>
            <label className={label}>Modelo (iPhone 6 al 17, todas las variantes)
              <select aria-label="Seleccionar modelo de iPhone" className={input} value={iphoneModels.includes(form.model) ? form.model : '__other__'} onChange={(e) => change('model', e.target.value === '__other__' ? '' : e.target.value)}>
                {iphoneModels.map((m) => <option key={m} value={m}>{m}</option>)}
                <option value="__other__">Otro modelo / modelo futuro…</option>
              </select>
              {!iphoneModels.includes(form.model) ? (
                <input aria-label="Escribir otro modelo de teléfono" className={input} placeholder="Ej.: iPhone 18 o un modelo especial" required value={form.model} onChange={(e) => change('model', e.target.value)} />
              ) : null}
            </label>
            <label className={label}>Falla
              <select className={input} value={form.fault} onChange={(e) => change('fault', e.target.value as FaultType)}>
                {Object.entries(faults).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
              </select>
            </label>
            <label className={label}>Pantalla
              <select className={input} value={form.screen} onChange={(e) => change('screen', e.target.value as ScreenCondition)}>
                <option value="unknown">Sin verificar</option><option value="good">Buena</option><option value="damaged">Dañada</option>
              </select>
            </label>
            <label className={label}>¿Enciende?
              <select className={input} value={form.power} onChange={(e) => change('power', e.target.value as PowerState)}>
                <option value="unknown">Sin verificar</option><option value="yes">Sí</option><option value="no">No</option>
              </select>
            </label>
            {([
              ['low', 'Estimado mínimo'], ['high', 'Estimado máximo'],
              ['asking', 'Precio para Facebook'], ['minimum', 'Mínimo aceptable'],
            ] as const).map(([field, title]) => <label key={field} className={label}>{title} (UYU)
              <input className={input} type="number" min="0" step="0.01" value={form[field]} onChange={(e) => change(field, e.target.value)} />
            </label>)}
            <label className={label}>Estado del anuncio
              <select className={input} value={form.status} onChange={(e) => change('status', e.target.value as PublicationStatus)}>
                {Object.entries(statuses).map(([value, title]) => <option key={value} value={value}>{title}</option>)}
              </select>
            </label>
            <label className={label}>URL del anuncio
              <input className={input} type="url" value={form.postUrl} onChange={(e) => change('postUrl', e.target.value)} placeholder="https://www.facebook.com/..." />
            </label>
          </div>
          {reference ? <div className="mt-3 flex flex-wrap items-center gap-2 bg-amber-50 p-2 text-xs text-amber-900">
            <span>Referencia orientativa histórica:  {reference[0]} a  {reference[1]} UYU. No cotización en vivo.</span>
            <button className="rounded border px-2 py-1 font-semibold" type="button" onClick={() => setForm((old) => ({
              ...old, low: String(reference[0]), high: String(reference[1]),
              source: 'Referencia inicial estimada, no verificada en vivo.',
            }))}>Aplicar referencia</button>
          </div> : <p className="mt-2 text-xs text-slate-500">Sin referencia previa para esta combinación. Introducí tu tasación manual.</p>}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className={label}>Fuentes de mercado y enlaces
              <textarea className={input + ' min-h-16 py-2'} value={form.source} onChange={(e) => change('source', e.target.value)} />
            </label>
            <label className={label}>Estado y piezas aprovechables
              <textarea className={input + ' min-h-16 py-2'} value={form.notes} onChange={(e) => change('notes', e.target.value)} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <strong className="text-xs">Texto para publicar en Facebook</strong>
            <div className="flex gap-2">
              <button className="rounded border px-2 py-1 text-xs" type="button" onClick={() => change('ad', createAd(form))}>Generar texto</button>
              <button className="rounded border px-2 py-1 text-xs" type="button" disabled={!form.ad} onClick={() => {
                void navigator.clipboard.writeText(form.ad).then(() => setNotice('Texto copiado.')).catch(() => setError('Seleccioná y copiá el texto manualmente.'));
              }}>Copiar</button>
            </div>
          </div>
          <textarea className={input + ' mt-1 min-h-32 py-2'} value={form.ad} onChange={(e) => change('ad', e.target.value)} />
          <p className="mt-1 text-[11px] text-slate-500">El texto se copia para publicar manualmente. No incluir IMEI ni prometer desbloqueo de iCloud.</p>
          <button className="mt-3 rounded-md bg-[var(--theme-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar valoración'}</button>
        </form>
      </SurfaceCard>
      <SurfaceCard>
        <h2 className="mb-3 text-sm font-semibold">Mis publicaciones individuales</h2>
        {loading ? <p className="text-xs">Cargando…</p> : items.length === 0 ? <p className="text-xs text-slate-500">Todavía no tenés fichas guardadas.</p> :
          <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs">
            <thead><tr className="border-b text-slate-500"><th className="p-2">Equipo</th><th className="p-2">Falla</th><th className="p-2">Estimado</th><th className="p-2">Publicar</th><th className="p-2">Estado</th><th className="p-2">Acción</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id} className="border-b border-slate-100">
              <td className="p-2 font-semibold">{item.model_name}</td><td className="p-2">{faults[item.fault_type]}</td>
              <td className="p-2">{displayCash(item.estimated_min_minor)} / {displayCash(item.estimated_max_minor)}</td>
              <td className="p-2">{displayCash(item.asking_price_minor)}</td><td className="p-2">{statuses[item.publication_status]}</td>
              <td className="p-2"><button className="text-[var(--theme-primary)]" type="button" onClick={() => edit(item)}>Editar</button></td>
            </tr>)}</tbody>
          </table></div>}
      </SurfaceCard>
    </div>
  </PageShell>;
}
