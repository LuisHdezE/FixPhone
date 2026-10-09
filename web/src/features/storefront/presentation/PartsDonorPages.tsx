import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { PublicPartsDonor } from '../application/partsDonor.types';
import { partsDonorPrice } from '../application/partsDonor.types';

const endpoint = '/api/v1/store/parts-donors';
const conditionLabel: Record<PublicPartsDonor['screen_condition'], string> = {
  good: 'Pantalla en buen estado según revisión',
  damaged: 'Pantalla dañada',
  unknown: 'Pantalla sin verificar',
};
const powerLabel: Record<PublicPartsDonor['power_state'], string> = {
  yes: 'Enciende',
  no: 'No enciende',
  unknown: 'Encendido sin verificar',
};

export function PartsDonorCatalogPage() {
  const [items, setItems] = useState<PublicPartsDonor[]>([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch(endpoint, { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo consultar la disponibilidad.');
        return response.json() as Promise<{ data: PublicPartsDonor[] }>;
      })
      .then((payload) => { if (active) setItems(payload.data); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.'); })
      .finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, []);

  return <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6" data-parts-donor-catalog>
    <Link className="text-xs font-semibold text-slate-600" to="/store">← FixPhone</Link>
    <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--storefront-primary)]">Productos · Celulares</p>
    <h1 className="mt-2 text-2xl font-black text-slate-950">Celulares para repuestos</h1>
    <p className="mt-2 max-w-3xl text-sm text-slate-600">Equipos completos o parcialmente funcionales, con fallas declaradas, ofrecidos por unidad para recuperar componentes. No son celulares listos para usar.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <Link className="rounded-full border px-3 py-1.5 text-xs font-semibold" to="/store/used-phones">Celulares usados funcionales</Link>
      <Link className="rounded-full border px-3 py-1.5 text-xs font-semibold" to="/store/spare-parts">Repuestos individuales</Link>
    </div>
    {pending ? <p className="mt-8 text-sm" role="status">Consultando disponibilidad…</p> : null}
    {error ? <p className="mt-8 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p> : null}
    {!pending && !error && !items.length ? <section className="mt-8 rounded-xl border bg-white p-6">
      <h2 className="font-bold">Sin equipos publicados por el momento</h2>
      <p className="mt-2 text-sm text-slate-600">Pronto habrá nuevas unidades disponibles para repuestos. Consultá también nuestras otras categorías.</p>
      <Link className="mt-4 inline-block text-sm font-semibold text-[var(--storefront-primary)]" to="/store/contact">Contactar a FixPhone</Link>
    </section> : null}
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <Link to={item.href} aria-label={'Ver ' + item.title}>
          <img src={item.image_url} alt={'Fotografía real del ' + item.model_name} className="aspect-[4/3] w-full object-contain bg-slate-50" loading="lazy" />
        </Link>
        <div className="grid gap-2 p-4">
          <span className="w-fit rounded bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900">Para repuestos · Con falla</span>
          <h2 className="text-lg font-bold text-slate-900">{item.model_name}</h2>
          <p className="text-sm text-slate-600">{item.fault_label}</p>
          <p className="text-lg font-black">{partsDonorPrice(item.price_minor)}</p>
          <Link className="w-fit rounded-full bg-[var(--storefront-primary)] px-4 py-2 text-xs font-bold text-[var(--storefront-on-primary)]" to={item.href}>Ver estado y fotos</Link>
        </div>
      </article>)}
    </div>
  </main>;
}

export function PartsDonorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<PublicPartsDonor | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setPending(true);
    setError('');
    fetch(endpoint + '/' + encodeURIComponent(id), { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (response.status === 404) throw new Error('Este equipo ya no está publicado o disponible.');
        if (!response.ok) throw new Error('No fue posible consultar la ficha.');
        return response.json() as Promise<{ data: PublicPartsDonor }>;
      })
      .then((payload) => { if (active) setItem(payload.data); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Producto no disponible.'); })
      .finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [id]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return <main className="mx-auto max-w-[1120px] px-4 py-6 sm:px-6" data-parts-donor-detail>
    <nav className="flex gap-2 text-xs font-semibold text-slate-500">
      <Link to="/store">FixPhone</Link><span>›</span><Link to="/store/for-parts">Celulares para repuestos</Link>
    </nav>
    {pending ? <p className="mt-8 text-sm" role="status">Cargando ficha…</p> : null}
    {error ? <div className="mt-8 rounded-xl border bg-white p-6" role="alert">
      <h1 className="text-lg font-bold">{error}</h1>
      <Link to="/store/for-parts" className="mt-3 inline-block text-sm font-semibold">Volver al catálogo</Link>
    </div> : null}
    {item && !pending && !error ? <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.78fr]">
      <div className="overflow-hidden rounded-xl border bg-white">
        <img src={item.image_url} alt={'Fotografía real de ' + item.title} className="aspect-[4/3] w-full object-contain bg-slate-50" />
        <p className="p-3 text-xs text-slate-500">Imagen de referencia de esta unidad específica. Consultá si necesitás más fotografías de los componentes.</p>
      </div>
      <div className="grid content-start gap-3 rounded-xl border bg-white p-5">
        <p className="w-fit rounded bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900">Equipo con falla · Solo para repuestos</p>
        <h1 className="text-2xl font-black">{item.title}</h1>
        <p className="text-sm font-semibold text-rose-800">{item.fault_label}</p>
        <p className="text-2xl font-black">{partsDonorPrice(item.price_minor)}</p>
        <p className="text-xs font-semibold text-emerald-800">Disponible para consulta · Una unidad</p>
        <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm">
          <p>{conditionLabel[item.screen_condition]}</p>
          <p>{powerLabel[item.power_state]}</p>
        </div>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{item.description}</p>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          Aviso: este equipo se ofrece en su estado actual para repuestos. No se garantiza desbloqueo de iCloud, señal móvil ni funcionamiento como teléfono. Verificá la compatibilidad de cada componente antes de comprar.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-full bg-[var(--storefront-primary)] px-4 py-2 text-xs font-bold text-[var(--storefront-on-primary)]" to="/store/contact">Consultar a FixPhone</Link>
          <button type="button" onClick={() => void copyLink()} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold">{copied ? 'Enlace copiado' : 'Copiar enlace para Facebook'}</button>
        </div>
        <p className="text-xs text-slate-500">Publicación individual. No se admite compra directa sin confirmar disponibilidad y estado.</p>
      </div>
    </div> : null}
  </main>;
}
