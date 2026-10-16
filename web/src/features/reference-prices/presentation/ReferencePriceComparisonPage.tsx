import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PageShell } from '@/shell/PageShell';
import { SurfaceCard } from '@/components/layout/SurfaceCard';
import {
  archiveOwnPrice, createOwnPrice, getComparison, getComparisonOptions, updateOwnPrice,
  SERVICE_NAMES, type ComparisonResult, type OwnPrice, type OwnPriceInput, type ServiceCode,
} from '../infrastructure/referencePriceComparisonGateway';

const input = 'h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs';
const outline = 'h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50';
const primary = 'h-8 rounded-md bg-[var(--theme-primary)] px-3 text-xs font-semibold text-white disabled:opacity-50';
const failure = (error: unknown) => error instanceof Error ? error.message : 'Operación no disponible.';
const money = (value: OwnPrice) => (Number(value.price_minor) / 100).toFixed(2) + ' ' + value.currency;
type Modal = { kind: 'create' } | { kind: 'edit' | 'archive'; price: OwnPrice };
const empty = (model: string, service_code: ServiceCode): OwnPriceInput => ({
  model, service_code, service_name: '', currency: 'UYU', price_amount: '', notes: '',
});

export function ReferencePriceComparisonPage() {
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [service, setService] = useState<ServiceCode>('BATTERY');
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalError, setModalError] = useState('');
  const [modal, setModal] = useState<Modal | null>(null);
  const [form, setForm] = useState<OwnPriceInput>(empty('', 'BATTERY'));
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let alive = true;
    getComparisonOptions().then((value) => {
      if (alive) {
        setModels(value.models);
        setModel((old) => old || value.models[0] || '');
      }
    }).catch((reason: unknown) => { if (alive) setError(failure(reason)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!model) { setComparison(null); return; }
    let alive = true;
    setLoading(true);
    setError('');
    getComparison(model, service).then((value) => { if (alive) setComparison(value); })
      .catch((reason: unknown) => { if (alive) { setComparison(null); setError(failure(reason)); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [model, service]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (modal && !element.open) element.showModal();
    if (!modal && element.open) element.close();
  }, [modal]);

  async function reload() {
    const [options, value] = await Promise.all([
      getComparisonOptions(), getComparison(model, service),
    ]);
    setModels(options.models);
    setComparison(value);
  }
  function startCreate() {
    setNotice(''); setModalError('');
    setForm(empty(model, service));
    setModal({ kind: 'create' });
  }
  function startEdit(price: OwnPrice) {
    setNotice(''); setModalError('');
    setForm({
      model: price.model, service_code: price.service_code, service_name: price.service_name,
      currency: price.currency, price_amount: (price.price_minor / 100).toFixed(2),
      notes: price.notes || '',
    });
    setModal({ kind: 'edit', price });
  }
  function closeModal() {
    if (!busy) { setModal(null); setModalError(''); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || modal.kind === 'archive' || busy) return;
    setBusy(true); setModalError('');
    try {
      if (!/^\d{1,8}\.\d{2}$/.test(form.price_amount) || Number(form.price_amount) <= 0) {
        throw new Error('Indicá un precio positivo con dos decimales, por ejemplo 1500.00.');
      }
      if (modal.kind === 'create') await createOwnPrice({ ...form, service_name: form.service_name.trim() });
      else await updateOwnPrice(modal.price.id, form.price_amount, form.notes, modal.price.version);
      await reload();
      setModal(null); setNotice('Tarifa propia guardada correctamente.');
    } catch (reason) { setModalError(failure(reason)); }
    finally { setBusy(false); }
  }
  async function archive() {
    if (modal?.kind !== 'archive' || busy) return;
    setBusy(true); setModalError('');
    try {
      await archiveOwnPrice(modal.price.id, modal.price.version);
      await reload(); setModal(null); setNotice('Tarifa propia archivada.');
    } catch (reason) { setModalError(failure(reason)); }
    finally { setBusy(false); }
  }

  const refs = comparison?.references || [];
  const own = comparison?.own || [];

  return <PageShell
    title="Comparador de tarifas"
    description="Últimos precios observados por fuente y mercado, junto a las tarifas de referencia propias de FixPhone."
    breadcrumbs={[{ label: 'Administración' }, { label: 'Comparador de tarifas' }]}>
    <div className="grid gap-2" data-reference-comparison>
      {error ? <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">{error}</p> : null}
      {notice ? <p role="status" className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">{notice}</p> : null}
      <SurfaceCard>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-0.5 text-[11px] font-semibold">Modelo
            <select className={input} value={model} onChange={(event) => setModel(event.target.value)}>
              {models.length === 0 ? <option value="">Sin modelos disponibles</option> : null}
              {models.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-0.5 text-[11px] font-semibold">Tipo de reparación
            <select className={input} value={service} onChange={(event) => setService(event.target.value as ServiceCode)}>
              {Object.entries(SERVICE_NAMES).map(([code, title]) => <option key={code} value={code}>{title}</option>)}
            </select>
          </label>
          <button type="button" className={primary} disabled={!model || busy} onClick={startCreate}>+ Precio FixPhone</button>
        </div>
        <p className="mt-2 text-[11px] text-slate-600">
          No se convierten monedas ni se calculan diferencias porcentuales. Coincidir en modelo y categoría no demuestra que piezas, impuestos y condiciones sean equivalentes.
        </p>
      </SurfaceCard>
      {loading ? <p className="text-xs text-slate-500">Consultando referencias…</p> : null}
      {!loading && model ? <div className="grid gap-2 lg:grid-cols-2">
        <SurfaceCard>
          <h2 className="text-sm font-bold">Apple y MundoMac</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">{model} · {SERVICE_NAMES[service]}</p>
          {refs.length === 0 ? <p className="mt-2 text-xs text-slate-500">Sin tarifa verificada importada para este modelo y servicio.</p> : null}
          <div className="mt-2 grid gap-1.5">
            {refs.map((item, i) => <div key={i} className="min-w-0 rounded-md border border-slate-200 p-2">
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                <div>
                  <p className="text-xs font-semibold">{item.source} · {item.source_country}</p>
                  <p className="text-[11px] text-slate-700">{item.service_name}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{item.price_amount} {item.currency}</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {item.observed_date} · {item.price_type === 'published_estimate' ? 'Estimado' : 'Precio publicado'} · Impuestos: {item.tax_included === 'yes' ? 'incluidos' : item.tax_included === 'no' ? 'no incluidos' : 'sin especificar'}
                {item.is_stale ? ' · Más de 180 días' : ''}
              </p>
              {item.notes ? <p className="mt-1 break-words text-[11px] text-slate-600">{item.notes}</p> : null}
              <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                className="mt-1 inline-block break-all text-[11px] text-blue-700 underline">Consultar fuente original</a>
            </div>)}
          </div>
        </SurfaceCard>
        <SurfaceCard>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">FixPhone · tarifas propias</h2>
            <span className="text-[11px] text-slate-500">{own.length} opciones</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">Tarifas administrativas de referencia; no presupuestos de clientes.</p>
          {own.length === 0 ? <p className="mt-2 text-xs text-slate-500">Sin precio propio configurado. Usá «+ Precio FixPhone» para registrar uno.</p> : null}
          <div className="mt-2 grid gap-1.5">
            {own.map((item) => <div key={item.id} className="min-w-0 rounded-md border border-slate-200 p-2">
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                <div>
                  <p className="text-xs font-semibold">{item.service_name}</p>
                  <p className="text-[11px] text-slate-500">Tarifa v{item.version} · {item.updated_at?.slice(0, 10)}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{money(item)}</p>
              </div>
              {item.notes ? <p className="mt-1 text-[11px] text-slate-600">{item.notes}</p> : null}
              <div className="mt-2 flex justify-end gap-1.5">
                <button type="button" className={outline} onClick={() => startEdit(item)}>Editar</button>
                <button type="button" className={outline} onClick={() => {
                  setModalError(''); setModal({ kind: 'archive', price: item });
                }}>Archivar</button>
              </div>
            </div>)}
          </div>
        </SurfaceCard>
      </div> : null}
      <p className="text-[11px] text-slate-500">Fuente: últimos registros históricos importados. Si no hay cotización propia para una combinación, se indica explícitamente. Los presupuestos comerciales y el inventario no se modifican.</p>
    </div>
    <dialog ref={dialog} onCancel={(event) => { if (busy) event.preventDefault(); else closeModal(); }}
      onClose={() => { if (!busy) setModal(null); }}
      aria-label="Edición de tarifa propia de FixPhone"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[min(96vw,540px)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-950/50">
      {modal ? <div className="grid gap-2 p-3">
        <div className="flex justify-between gap-2 border-b border-slate-100 pb-2">
          <h2 className="text-sm font-bold">{modal.kind === 'create' ? 'Nueva tarifa FixPhone' : modal.kind === 'edit' ? 'Editar tarifa FixPhone' : 'Archivar tarifa FixPhone'}</h2>
          <button type="button" className={outline} disabled={busy} onClick={closeModal}>Cerrar</button>
        </div>
        {modalError ? <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-2 text-xs">{modalError}</p> : null}
        {modal.kind === 'archive' ? <>
          <p className="text-xs">¿Archivar {modal.price.service_name} para {modal.price.model}? Ya no aparecerá en la comparación. No afecta los presupuestos ni el historial de auditoría.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className={outline} onClick={closeModal}>Cancelar</button>
            <button type="button" className={primary} disabled={busy} onClick={() => void archive()}>{busy ? 'Archivando…' : 'Confirmar'}</button>
          </div>
        </> : <form className="grid gap-2" onSubmit={(event) => void save(event)}>
          <p className="text-[11px] text-slate-600">{model} · {SERVICE_NAMES[service]}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-0.5 text-[11px] font-semibold">Nombre del servicio u opción
              <input className={input} required maxLength={160} disabled={modal.kind === 'edit'}
                value={form.service_name} onChange={(event) => setForm((value) => ({ ...value, service_name: event.target.value }))} />
            </label>
            <label className="grid gap-0.5 text-[11px] font-semibold">Moneda
              <select className={input} disabled={modal.kind === 'edit'} value={form.currency}
                onChange={(event) => setForm((value) => ({ ...value, currency: event.target.value as 'UYU' | 'USD' }))}>
                <option value="UYU">Pesos uruguayos · UYU</option>
                <option value="USD">Dólares · USD</option>
              </select>
            </label>
          </div>
          <label className="grid gap-0.5 text-[11px] font-semibold">Precio con dos decimales
            <input className={input} required inputMode="decimal" pattern="[0-9]{1,8}\\.[0-9]{2}"
              placeholder="1500.00" value={form.price_amount} onChange={(event) => setForm((value) => ({ ...value, price_amount: event.target.value }))} />
          </label>
          <label className="grid gap-0.5 text-[11px] font-semibold">Condiciones y tipo de repuesto (opcional)
            <textarea className="max-h-28 min-h-16 w-full resize-y rounded-md border border-slate-200 p-2 text-xs"
              maxLength={1000} value={form.notes} onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))} />
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
            <button type="button" className={outline} onClick={closeModal}>Cancelar</button>
            <button type="submit" className={primary} disabled={busy || !form.service_name.trim()}>{busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>}
      </div> : null}
    </dialog>
  </PageShell>;
}
