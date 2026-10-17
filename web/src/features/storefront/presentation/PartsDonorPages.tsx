import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { PublicPartsDonor } from '../application/partsDonor.types';
import { partsDonorPrice } from '../application/partsDonor.types';
import { partsDonorCatalogCards } from '../application/partsDonorCatalog';
import { StorefrontCatalogProducts } from './StorefrontCatalogProducts';

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

  const products = useMemo(() => partsDonorCatalogCards(items), [items]);
  return <StorefrontCatalogProducts
    catalogKey="for-parts"
    products={products}
    pending={pending}
    error={error}
    emptyMessage="No hay equipos publicados para repuestos con estos criterios."
  />;
}

export function PartsDonorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<PublicPartsDonor | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');

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
      .then((payload) => { if (active) { setItem(payload.data); setSelectedImage(payload.data.image_url); } })
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
        <img src={selectedImage || item.image_url} alt={'Fotografía real de ' + item.title} className="aspect-[4/3] w-full object-contain bg-slate-50" />
        {item.images.length > 1 ? <div className="grid grid-cols-4 gap-2 p-3">
          {item.images.map((image, index) => <button className={'overflow-hidden rounded border-2 ' + ((selectedImage || item.image_url) === image ? 'border-slate-900' : 'border-transparent')} type="button" key={image} onClick={() => setSelectedImage(image)} aria-label={'Ver fotografía ' + (index + 1)}>
            <img src={image} alt={'Vista ' + (index + 1) + ' del equipo'} className="aspect-square w-full object-cover" loading="lazy" />
          </button>)}
        </div> : null}
        <p className="p-3 text-xs text-slate-500">Fotografías de esta unidad específica. Consultá por sus condiciones antes de comprar.</p>
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
