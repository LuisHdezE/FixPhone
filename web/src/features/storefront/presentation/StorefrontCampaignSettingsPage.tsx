import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { adminFetch } from '@/auth/adminApiSession';
import { AppIcon } from '@/components/AppIcon';
import type { StorefrontHeroBannerDto } from '../application/storefront.dto';
import { JsonStorefrontProvider } from '../infrastructure/JsonStorefrontProvider';
import { uploadCampaignImage } from '../infrastructure/campaignImageUpload';

const defaults = new JsonStorefrontProvider().getHomeView().heroBanners;
type CampaignResponse = { data: { slides: StorefrontHeroBannerDto[] } | null; message?: string; detail?: string; errors?: Record<string, string[]> };
const input = 'h-8 w-full min-w-0 rounded border border-slate-200 bg-white px-2 text-xs';
const label = 'grid min-w-0 gap-1 text-[11px] font-medium text-slate-600';
const iconButton = 'rounded border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30';
async function decode(response: Response): Promise<CampaignResponse> {
  const body = await response.json() as CampaignResponse;
  if (!response.ok) throw new Error(body.errors ? Object.values(body.errors).flat().join(' ') : body.detail || body.message || 'No se pudo guardar el carrusel.');
  return body;
}
export function StorefrontCampaignSettingsPage() {
  const [slides, setSlides] = useState<StorefrontHeroBannerDto[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const locked = busy || uploading !== null;
  useEffect(() => {
    let active = true;
    adminFetch('/api/v1/admin/store/campaigns').then(decode).then(body => {
      if (!active) return;
      const loaded = structuredClone(body.data?.slides ?? defaults) as StorefrontHeroBannerDto[];
      setSlides(loaded); setExpanded(loaded[0]?.id ?? null); setReady(true);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el carrusel.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  function patch(id: string, values: Partial<StorefrontHeroBannerDto>) {
    setSlides(current => current.map(slide => slide.id === id ? { ...slide, ...values } : slide)); setNotice('');
  }
  function move(index: number, delta: number) {
    setSlides(current => { const next = [...current]; const other = index + delta;
      if (other < 0 || other >= next.length) return current;
      [next[index], next[other]] = [next[other]!, next[index]!]; return next;
    }); setNotice('');
  }
  function add() {
    const id = crypto.randomUUID();
    setSlides(current => [...current, { id, eyebrow: '', title: 'Nuevo anuncio', description: '', actionLabel: 'Ver productos',
      actionHref: '/store/products', image: { src: '/assets/store/hero.webp', alt: 'Celulares FixPhone', objectPosition: 'center' } }]);
    setExpanded(id); setNotice('');
  }
  async function upload(id: string, file: File) {
    setUploading(id); setError(''); setNotice('');
    try {
      const url = await uploadCampaignImage(file);
      setSlides(current => current.map(slide => slide.id === id ? { ...slide, image: { ...slide.image, src: url } } : slide));
      setNotice('Imagen subida. Guardá el carrusel para publicar el cambio.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo subir la imagen.'); }
    finally { setUploading(null); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (locked) return;
    if (!event.currentTarget.checkValidity()) {
      const invalid = event.currentTarget.querySelector<HTMLInputElement | HTMLSelectElement>('input:invalid, select:invalid');
      const id = invalid?.closest('[data-campaign-id]')?.getAttribute('data-campaign-id');
      if (id) setExpanded(id);
      setError('Completá los campos obligatorios del anuncio antes de guardar.');
      requestAnimationFrame(() => invalid?.focus());
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const body = await decode(await adminFetch('/api/v1/admin/store/campaigns', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slides }) }));
      setSlides(body.data?.slides ?? []); setNotice('Carrusel guardado. Los cambios se muestran al abrir nuevamente la tienda.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-6xl p-3" data-campaign-editor>
    <form onSubmit={save} noValidate>
      <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
        <div><h1 className="text-base font-bold">Carrusel de la tienda <span className="ml-1 text-xs font-normal text-slate-500">{slides.length}/8 anuncios</span></h1>
          <p className="text-[11px] text-slate-500">Abrí un anuncio para editar su imagen y textos.</p></div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link to="/store" target="_blank" className="px-1 font-semibold text-red-600">Ver tienda ↗</Link>
          <button type="button" disabled={locked || !ready || slides.length >= 8} onClick={add} className="rounded border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">+ Anuncio</button>
          <button type="submit" disabled={locked || !ready} className="rounded bg-red-600 px-3 py-1.5 font-semibold text-white disabled:opacity-40">{busy ? 'Guardando…' : 'Guardar carrusel'}</button>
        </div>
      </div>
      {error && <p role="alert" className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-2 rounded bg-green-50 p-2 text-xs text-green-800">{notice}</p>}
      {loading ? <p className="text-xs">Cargando carrusel…</p> : !ready ? <p className="text-xs">Recargá la página para volver a intentar.</p> : <fieldset disabled={locked} className="grid gap-2">
        {slides.map((slide, index) => {
          const open = expanded === slide.id;
          return <section key={slide.id} data-campaign-id={slide.id} className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white" aria-label={'Anuncio ' + (index + 1)}>
            <div className="flex items-center gap-2 p-2">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open} aria-controls={'campaign-' + slide.id} onClick={() => setExpanded(open ? null : slide.id)}>
                <img src={slide.image.src} alt="" className="h-9 w-16 shrink-0 rounded bg-slate-100 object-cover" />
                <span className="min-w-0"><span className="block text-[10px] font-semibold uppercase text-slate-400">Anuncio {index + 1}</span><span className="block truncate text-xs font-semibold text-slate-800">{slide.title || 'Sin título'}</span></span>
                <AppIcon name={open ? 'x' : 'edit'} className="ml-auto size-4 shrink-0 text-slate-400" />
              </button>
              <div className="flex shrink-0 gap-1">
                <button type="button" disabled={index === 0} aria-label={'Subir anuncio ' + (index + 1)} title="Mover arriba" onClick={() => move(index, -1)} className={iconButton}>↑</button>
                <button type="button" disabled={index === slides.length - 1} aria-label={'Bajar anuncio ' + (index + 1)} title="Mover abajo" onClick={() => move(index, 1)} className={iconButton}>↓</button>
                <button type="button" aria-label={'Quitar anuncio ' + (index + 1)} title="Quitar anuncio" onClick={() => { setSlides(current => current.filter(item => item.id !== slide.id)); setNotice(''); }} className={iconButton + ' text-red-600'}><AppIcon name="trash" className="size-3.5" /></button>
              </div>
            </div>
            <div id={'campaign-' + slide.id} hidden={!open} className="border-t border-slate-100 p-2.5">
              <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                <div className="grid content-start gap-1.5">
                  <img src={slide.image.src} alt={slide.image.alt} className="h-24 w-full rounded bg-slate-100 object-contain" />
                  <label className={label}>Subir imagen
                    <input aria-label={'Subir imagen del anuncio ' + (index + 1)} type="file" accept="image/jpeg,image/png,image/webp"
                      className="w-full min-w-0 text-[10px] file:mr-1 file:rounded file:border-0 file:bg-red-50 file:px-2 file:py-1.5 file:text-[11px] file:font-semibold file:text-red-700"
                      onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void upload(slide.id, file); }} />
                  </label>
                  <p className="text-[10px] leading-4 text-slate-400">{uploading === slide.id ? 'Preparando y subiendo imagen…' : 'JPG, PNG o WebP · hasta 20 MB. Se optimiza automáticamente.'}</p>
                  <Link to="/admin/settings/media-storage" className="text-[10px] font-medium text-slate-500 underline">Configurar almacenamiento</Link>
                </div>
                <div className="grid content-start gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <label className={label + ' sm:col-span-2'}>Título<input required maxLength={100} className={input} value={slide.title} onChange={e => patch(slide.id, { title: e.target.value })} /></label>
                  <label className={label}>Antetítulo<input maxLength={60} className={input} value={slide.eyebrow} onChange={e => patch(slide.id, { eyebrow: e.target.value })} /></label>
                  <label className={label + ' sm:col-span-2 lg:col-span-3'}>Descripción<input maxLength={220} className={input} value={slide.description} onChange={e => patch(slide.id, { description: e.target.value })} /></label>
                  <label className={label}>Texto del botón<input required maxLength={40} className={input} value={slide.actionLabel} onChange={e => patch(slide.id, { actionLabel: e.target.value })} /></label>
                  <label className={label}>Enlace del botón<input required className={input} placeholder="/store/used-phones" value={slide.actionHref} onChange={e => patch(slide.id, { actionHref: e.target.value })} /></label>
                  <label className={label}>Encuadre<select className={input} value={slide.image.objectPosition ?? 'center'} onChange={e => patch(slide.id, { image: { ...slide.image, objectPosition: e.target.value } })}>{['center','top','bottom','left','right'].map(position => <option key={position} value={position}>{({ center:'Centro',top:'Arriba',bottom:'Abajo',left:'Izquierda',right:'Derecha' })[position]}</option>)}</select></label>
                  <label className={label + ' sm:col-span-2'}>URL de la imagen<input required maxLength={2000} className={input} value={slide.image.src} onChange={e => patch(slide.id, { image: { ...slide.image, src: e.target.value } })} /></label>
                  <label className={label}>Texto alternativo<input required maxLength={180} className={input} value={slide.image.alt} onChange={e => patch(slide.id, { image: { ...slide.image, alt: e.target.value } })} /></label>
                </div>
              </div>
            </div>
          </section>;
        })}
        {!slides.length && <p className="rounded border border-dashed p-3 text-xs text-slate-500">Sin anuncios. Al guardar, el carrusel quedará oculto.</p>}
      </fieldset>}
    </form>
  </div>;
}
