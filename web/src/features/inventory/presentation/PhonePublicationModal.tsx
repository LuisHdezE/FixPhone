import { useEffect, useState, type FormEvent } from 'react';
import { adminFetch } from '@/auth/adminApiSession';
import { ModalShell } from '@/components/layout/ModalShell';
import { StoreProductImageField } from '@/features/storefront/presentation/StoreProductImageField';

type Publication = {
  id: string; sku: string; title: string; description: string | null; price_minor: number | null;
  currency: string; image_url: string | null; published: boolean; stock_quantity: number; destination: string | null;
};

export function PhonePublicationModal({ id, onClose, onSaved }: {
  id: string; onClose: () => void; onSaved: (message: string) => void;
}) {
  const [data, setData] = useState<Publication | null>(null);
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const locked = busy || uploading;
  const url = '/api/v1/admin/inventory/phones/' + encodeURIComponent(id) + '/publication';
  const canPublish = data?.destination === 'Direct Sale';

  useEffect(() => {
    let active = true;
    void adminFetch(url, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('No se pudo cargar la ficha de publicación.');
        return response.json() as Promise<{ data: Publication }>;
      })
      .then(result => {
        if (active) {
          setData(result.data);
          setPrice(result.data.price_minor === null ? '' : String(result.data.price_minor / 100));
        }
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la publicación.'); });
    return () => { active = false; };
  }, [url]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || locked) return;
    const value = price.trim() ? Number(price.replace(',', '.')) : NaN;
    const minor = Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
    if (data.published && (!minor || !Number.isSafeInteger(minor))) {
      setError('Para publicar indicá un precio válido.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await adminFetch(url, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          title: data.title, description: data.description, price_minor: minor,
          currency: data.currency, image_url: data.image_url || null, published: data.published,
        }),
      });
      const result = await response.json().catch(() => null) as { message?: string; errors?: Record<string, string[]> } | null;
      if (!response.ok) throw new Error(result?.errors ? Object.values(result.errors).flat().join(' ') : result?.message || 'No se pudo guardar.');
      onSaved(data.published ? 'Teléfono publicado en la tienda.' : 'Ficha guardada sin publicación.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar.');
    } finally { setBusy(false); }
  }

  return <ModalShell title="Publicar teléfono en tienda" onClose={onClose} density="compact" disabled={locked}>
    <form className="grid gap-2 p-3 text-xs" onSubmit={event => void submit(event)}>
      {data ? <>
        <p className="text-slate-600">{data.sku} · Existencias: {data.stock_quantity}</p>
        <label className="grid gap-1">Título
          <input className="h-8 rounded border border-slate-300 px-2" required maxLength={255} value={data.title} onChange={event => setData({ ...data, title: event.target.value })} />
        </label>
        <label className="grid gap-1">Descripción real del estado y defectos
          <textarea className="rounded border border-slate-300 p-2" required minLength={10} maxLength={4000} rows={3} value={data.description ?? ''} onChange={event => setData({ ...data, description: event.target.value })} />
        </label>
        <div className="grid grid-cols-[1fr_110px] gap-2">
          <label className="grid gap-1">Precio
            <input className="h-8 rounded border border-slate-300 px-2" inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} />
          </label>
          <label className="grid gap-1">Moneda
            <select className="h-8 rounded border border-slate-300 px-2" value={data.currency} onChange={event => setData({ ...data, currency: event.target.value })}>
              <option value="UYU">UYU</option><option value="USD">USD</option>
            </select>
          </label>
        </div>
        <StoreProductImageField value={data.image_url} onChange={image_url => setData(current => current ? { ...current, image_url } : current)} disabled={busy} onUploadingChange={setUploading} productLabel={data.title} />
        <label className="flex items-center gap-2"><input type="checkbox" disabled={!canPublish} checked={canPublish && data.published} onChange={event => setData({ ...data, published: event.target.checked })} /> Visible en tienda</label>
        {!canPublish ? <p role="status" className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">Este equipo no está destinado a venta directa. Los dispositivos para repuestos o pendientes de evaluación no se pueden publicar como teléfono completo.</p> : null}
        <p className="text-[11px] text-slate-500">Podés venderlo sin reparar si su destino es Venta directa. Indicá los defectos reales. Publicar no registra una venta ni cambia el stock.</p>
      </> : !error ? <p>Cargando ficha…</p> : null}
      {error ? <p role="alert" className="rounded bg-red-50 p-2 text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
        <button type="button" className="h-8 rounded border px-3" disabled={locked} onClick={onClose}>Cancelar</button>
        <button type="submit" className="h-8 rounded bg-brand-600 px-3 text-white disabled:opacity-50" disabled={locked || !data}>{uploading ? 'Subiendo imagen…' : busy ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  </ModalShell>;
}
