import { useEffect, useState, type FormEvent } from 'react';
import { adminFetch } from '@/auth/adminApiSession';
import { ModalShell } from '@/components/layout/ModalShell';

type Publication = { title: string; description: string | null; variant: string; sku: string; condition: string; price_minor: number | null; currency: string; image_url: string | null; published: boolean; stock_quantity: number };

export function SparePartPublicationModal({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<Publication | null>(null);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const url = '/api/v1/admin/inventory/spare-parts/' + encodeURIComponent(id) + '/publication';
  useEffect(() => {
    let alive = true;
    setError(null);
    void adminFetch(url, { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('No se pudo cargar la publicación.');
      return response.json() as Promise<{ data: Publication }>;
    }).then(payload => { if (alive) { setData(payload.data); setPrice(payload.data.price_minor === null ? '' : String(payload.data.price_minor / 100)); } })
      .catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : 'No se pudo cargar.'); });
    return () => { alive = false; };
  }, [url, reload]);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !data) return;
    setBusy(true); setError(null);
    try {
      const minor = price.trim() ? Math.round(Number(price.replace(',', '.')) * 100) : null;
      if (minor !== null && (!Number.isSafeInteger(minor) || minor <= 0 || minor > 2147483647)) throw new Error('Indicá un precio válido mayor que cero.');
      const response = await adminFetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ title: data.title, description: data.description, condition: data.condition, price_minor: minor, currency: data.currency, image_url: data.image_url?.trim() || null, published: data.published }) });
      const body = await response.json().catch(() => null) as { message?: string; errors?: Record<string, string[]> } | null;
      if (!response.ok) throw new Error(body?.errors ? Object.values(body.errors).flat().join(' ') : body?.message || 'No se pudo guardar la publicación.');
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  return <ModalShell title="Publicación de repuesto" onClose={onClose} disabled={busy} density="compact" hideCloseButton>
    <form className="grid gap-2 p-3 text-xs" onSubmit={event => void submit(event)}>
      {data ? <>
        <p className="font-medium">{data.sku} · {data.title}</p>
        <p className="text-slate-500">Existencias: {data.stock_quantity}. La condición se aplica a todas las unidades de esta ficha.</p>
        {data.variant ? <p>Variante: {data.variant}</p> : null}
        <label className="grid gap-1">Título<input className="h-7 rounded border border-slate-200 px-2" required maxLength={255} value={data.title} disabled={busy} onChange={event => setData({ ...data, title: event.target.value })} /></label>
        <label className="grid gap-1">Descripción<textarea className="rounded border border-slate-200 px-2 py-1" rows={2} maxLength={2000} value={data.description ?? ''} disabled={busy} onChange={event => setData({ ...data, description: event.target.value })} /></label>
        <label className="grid gap-1">Condición<select className="h-7 rounded border border-slate-200 px-2" value={data.condition} disabled={busy} onChange={event => setData({ ...data, condition: event.target.value, published: false })}><option value="untested">Sin probar</option><option value="functional">Funcional</option><option value="faulty">Con fallas</option></select></label>
        <div className="grid grid-cols-[1fr_6rem] gap-2"><label className="grid gap-1">Precio<input className="h-7 rounded border border-slate-200 px-2" inputMode="decimal" value={price} disabled={busy} onChange={event => setPrice(event.target.value)} /></label><label className="grid gap-1">Moneda<select className="h-7 rounded border border-slate-200 px-2" value={data.currency} disabled={busy} onChange={event => setData({ ...data, currency: event.target.value })}><option>UYU</option><option>USD</option></select></label></div>
        <label className="grid gap-1">URL de imagen (opcional)<input className="h-7 rounded border border-slate-200 px-2" type="url" placeholder="https://…" value={data.image_url ?? ''} disabled={busy} onChange={event => setData({ ...data, image_url: event.target.value })} /></label>
        <label className="flex items-center gap-2 py-1"><input type="checkbox" checked={data.published} disabled={busy} onChange={event => setData({ ...data, published: event.target.checked })} />Publicar en el showroom</label>
        <p className="text-[11px] text-slate-500">Para publicar: condición funcional, precio y al menos una unidad disponible.</p>
      </> : !error ? <p role="status">Cargando…</p> : null}
      {error ? <div role="alert" className="rounded bg-red-50 p-2 text-red-700">{error}{!data ? <button type="button" className="ml-2 underline" onClick={() => setReload(value => value + 1)}>Reintentar</button> : null}</div> : null}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-2"><button type="button" disabled={busy} className="h-7 rounded border border-slate-200 px-3" onClick={onClose}>Cancelar</button><button type="submit" disabled={busy || !data} className="h-7 rounded bg-brand-600 px-3 text-white disabled:opacity-40">Guardar</button></div>
    </form>
  </ModalShell>;
}
