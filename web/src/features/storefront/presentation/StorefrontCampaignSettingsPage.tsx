import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { adminFetch } from '@/auth/adminApiSession';
import type { StorefrontHeroBannerDto } from '../application/storefront.dto';
import { JsonStorefrontProvider } from '../infrastructure/JsonStorefrontProvider';

const defaults = new JsonStorefrontProvider().getHomeView().heroBanners;
type CampaignResponse = { data: { slides: StorefrontHeroBannerDto[] } | null; message?: string; errors?: Record<string, string[]> };
const input = 'w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs';
async function decode(response: Response): Promise<CampaignResponse> {
  const body = await response.json() as CampaignResponse;
  if (!response.ok) throw new Error(body.errors ? Object.values(body.errors).flat().join(' ') : body.message || 'No se pudo guardar el carrusel.');
  return body;
}
export function StorefrontCampaignSettingsPage() {
  const [slides, setSlides] = useState<StorefrontHeroBannerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    adminFetch('/api/v1/admin/store/campaigns').then(decode).then(body => { if (active) { setSlides(structuredClone(body.data?.slides ?? defaults) as StorefrontHeroBannerDto[]); setReady(true); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el carrusel.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  function patch(index: number, values: Partial<StorefrontHeroBannerDto>) { setSlides(current => current.map((slide, i) => i === index ? { ...slide, ...values } : slide)); setNotice(''); }
  function move(index: number, delta: number) {
    setSlides(current => { const next = [...current]; const other = index + delta; if (other < 0 || other >= next.length) return current; [next[index], next[other]] = [next[other]!, next[index]!]; return next; }); setNotice('');
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const body = await decode(await adminFetch('/api/v1/admin/store/campaigns', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slides }) }));
      setSlides(body.data?.slides ?? []); setNotice('Carrusel guardado. Los cambios se muestran al abrir nuevamente la tienda.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-5xl p-4">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold">Carrusel de la tienda</h1><p className="mt-1 text-xs text-slate-600">Editá imágenes, anuncios y enlaces. Hasta 8 diapositivas, en el orden mostrado.</p></div><Link className="text-xs font-semibold text-red-600" to="/store" target="_blank">Ver tienda ↗</Link></div>
    {error && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-xs text-red-700">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-md bg-green-50 p-3 text-xs text-green-800">{notice}</p>}
    {loading ? <p>Cargando carrusel…</p> : !ready ? <p className="text-xs">Recargá la página para volver a intentar.</p> : <form onSubmit={save}>
      <fieldset disabled={busy} className="grid gap-3">
        {slides.map((slide, index) => <section key={slide.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-bold">Anuncio {index + 1}</h2><div className="flex gap-2 text-xs">
            <button type="button" disabled={index === 0} aria-label={`Subir anuncio ${index + 1}`} onClick={() => move(index, -1)} className="rounded border px-3 py-2 disabled:opacity-30">↑</button>
            <button type="button" disabled={index === slides.length - 1} aria-label={`Bajar anuncio ${index + 1}`} onClick={() => move(index, 1)} className="rounded border px-3 py-2 disabled:opacity-30">↓</button>
            <button type="button" onClick={() => { setSlides(current => current.filter((_, i) => i !== index)); setNotice(''); }} className="rounded border px-3 py-2 text-red-600">Quitar</button>
          </div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">Título<input required maxLength={100} className={input} value={slide.title} onChange={e => patch(index, { title: e.target.value })} /></label>
            <label className="grid gap-1 text-xs">Antetítulo<input maxLength={60} className={input} value={slide.eyebrow} onChange={e => patch(index, { eyebrow: e.target.value })} /></label>
            <label className="grid gap-1 text-xs sm:col-span-2">Descripción<input maxLength={220} className={input} value={slide.description} onChange={e => patch(index, { description: e.target.value })} /></label>
            <label className="grid gap-1 text-xs">Texto del botón<input required maxLength={40} className={input} value={slide.actionLabel} onChange={e => patch(index, { actionLabel: e.target.value })} /></label>
            <label className="grid gap-1 text-xs">Enlace dentro de la tienda<input required className={input} placeholder="/store/used-phones" value={slide.actionHref} onChange={e => patch(index, { actionHref: e.target.value })} /></label>
            <label className="grid gap-1 text-xs sm:col-span-2">URL pública de la imagen (R2 / HTTPS)<input required maxLength={2000} className={input} value={slide.image.src} onChange={e => patch(index, { image: { ...slide.image, src: e.target.value } })} /><span className="text-[11px] text-slate-500">Usá una imagen horizontal con espacio a la izquierda para el texto. Pegá la URL pública completa del almacenamiento configurado.</span></label>
            <label className="grid gap-1 text-xs">Descripción accesible de la imagen<input required maxLength={180} className={input} value={slide.image.alt} onChange={e => patch(index, { image: { ...slide.image, alt: e.target.value } })} /></label>
            <label className="grid gap-1 text-xs">Encuadre<select className={input} value={slide.image.objectPosition ?? 'center'} onChange={e => patch(index, { image: { ...slide.image, objectPosition: e.target.value } })}>{['center','top','bottom','left','right'].map(position => <option key={position} value={position}>{({ center:'Centro',top:'Arriba',bottom:'Abajo',left:'Izquierda',right:'Derecha' })[position]}</option>)}</select></label>
          </div>
        </section>)}
        {!slides.length && <p className="rounded border border-dashed p-4 text-xs">Sin anuncios: al guardar, el carrusel quedará oculto.</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={slides.length >= 8} className="rounded-md border bg-white px-4 py-2 text-xs font-semibold disabled:opacity-40" onClick={() => setSlides(current => [...current, { id: crypto.randomUUID(), eyebrow: '', title: 'Nuevo anuncio', description: '', actionLabel: 'Ver productos', actionHref: '/store/products', image: { src: '/assets/store/hero.webp', alt: 'Celulares FixPhone', objectPosition: 'center' } }])}>Agregar anuncio</button>
          <button type="submit" className="rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white">{busy ? 'Guardando…' : 'Guardar carrusel'}</button>
        </div>
      </fieldset>
    </form>}
  </div>;
}
