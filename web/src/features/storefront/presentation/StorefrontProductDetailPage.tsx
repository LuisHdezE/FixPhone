import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { cartRequest } from '../infrastructure/storefrontApi';
import { useStorefrontSession } from './useStorefrontSession';
import type { StorefrontProvider } from '../application/storefront.contracts';

function galleryClassName(tone: string) {
  if (tone === 'dark') return 'bg-slate-950 text-white';
  if (tone === 'warm') return 'bg-[#f7f2ea] text-slate-950';
  return 'bg-white text-slate-950';
}

export function StorefrontProductDetailPage({ provider }: { provider: StorefrontProvider }) {
  const { slug = '' } = useParams();
  const { customer, loading } = useStorefrontSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function addToCart() {
    if (!customer) { navigate('/store/account/sign-in', { state: { from: location.pathname } }); return; }
    setBusy(true); setNotice('');
    try { await cartRequest('POST', slug); navigate('/store/cart'); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : 'No se pudo agregar al carrito.'); }
    finally { setBusy(false); }
  }

  const detail = provider.getProductDetailView();
  const product = provider.getProductDetailBySlug(slug);
  const images = product ? (product.images?.length ? product.images : product.image ? [product.image] : []) : [];
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    setActiveImage(0);
  }, [slug]);

  const selectedImage = images[activeImage] ?? images[0];

  function moveImage(delta: number) {
    if (images.length < 2) return;
    setActiveImage((current) => (current + delta + images.length) % images.length);
  }

  if (!product) {
    return (
      <main className="mx-auto grid max-w-[960px] gap-3 px-4 py-6 sm:px-5 lg:px-6" data-storefront-product-detail-not-found>
        <Link className="text-xs font-black text-slate-600 hover:text-slate-950" to={detail.notFound.actionHref}>← {detail.notFound.actionLabel}</Link>
        <section className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{detail.eyebrow}</p>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.035em] text-slate-950">{detail.notFound.title}</h1>
          <p className="mt-2 max-w-2xl text-[11px] leading-4 text-slate-600">{detail.notFound.description}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-[1440px] gap-3 px-4 py-3 sm:px-5 lg:px-6 lg:py-4" data-storefront-product-detail>
      <Link className="text-xs font-black text-slate-600 hover:text-slate-950" to={detail.backHref}>← {detail.backLabel}</Link>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,.9fr)_20rem] lg:items-start">
        <div className="grid gap-3" data-storefront-gallery-wrapper>
          <div className="grid gap-2 lg:col-start-1" data-storefront-device-gallery>
            <div className="relative flex aspect-square sm:aspect-[4/3] min-h-[18rem] sm:min-h-[22rem] max-h-[28rem] w-full select-none items-center justify-center rounded-xl border border-slate-200/80 bg-white p-2 shadow-xs">
              {selectedImage ? (
                <img
                  src={selectedImage.src}
                  alt={selectedImage.alt}
                  className="h-full w-full object-contain"
                  loading="eager"
                  data-storefront-gallery-main-image
                />
              ) : (
                <div className="grid aspect-[4/3] w-full place-items-center rounded-xl bg-slate-50 text-xs text-slate-500">
                  Sin imagen disponible
                </div>
              )}
              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Foto anterior"
                    onClick={() => moveImage(-1)}
                    className="absolute left-2.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-black/10 bg-white/90 text-lg font-bold text-slate-800 shadow-sm backdrop-blur-xs transition hover:bg-white active:scale-95 touch-manipulation focus:outline-none"
                    data-storefront-gallery-prev
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Foto siguiente"
                    onClick={() => moveImage(1)}
                    className="absolute right-2.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-black/10 bg-white/90 text-lg font-bold text-slate-800 shadow-sm backdrop-blur-xs transition hover:bg-white active:scale-95 touch-manipulation focus:outline-none"
                    data-storefront-gallery-next
                  >
                    ›
                  </button>
                  <span
                    className="absolute bottom-2.5 right-2.5 rounded-full bg-slate-950/75 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white backdrop-blur-xs pointer-events-none"
                    data-storefront-gallery-counter
                  >
                    {`${activeImage + 1} / ${images.length}`}
                  </span>
                </>
              ) : null}
            </div>

            {images.length > 1 ? (
              <div
                className="flex gap-2 overflow-x-auto pb-1 pt-0.5"
                aria-label="Fotos del producto"
                data-storefront-gallery-thumbnails
              >
                {images.map((image, index) => {
                  const isActive = index === activeImage;
                  return (
                    <button
                      key={image.src + '-' + index}
                      type="button"
                      aria-label={`Ver foto ${index + 1}`}
                      aria-current={isActive ? 'true' : undefined}
                      onClick={() => setActiveImage(index)}
                      className={`relative size-16 shrink-0 overflow-hidden rounded-lg border p-1 transition touch-manipulation focus:outline-none ${
                        isActive
                          ? 'border-[var(--storefront-primary,#0f172a)] ring-2 ring-[var(--storefront-primary,#0f172a)] bg-slate-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      data-storefront-gallery-thumbnail={index}
                    >
                      <img
                        src={image.src}
                        alt=""
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {product.gallery.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-3 lg:col-start-1" aria-label="Galería del producto">
              {product.gallery.map((item) => (
                <div key={item.id} className={`rounded-xl border border-black/10 p-3 text-xs font-black shadow-sm ${galleryClassName(item.tone)}`}>
                  {item.label}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-start-2">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{detail.eyebrow}</p>
          <h1 className="mt-2 text-[clamp(0.9rem,1.2vw,1.1rem)] font-normal leading-tight tracking-[-0.03em] text-slate-950">{product.title}</h1>
          <p className="mt-3 text-[11px] leading-5 text-slate-600">{product.subtitle}</p>
          <div className="mt-5 border-t border-slate-200 pt-4">
            <h2 className="text-sm font-black text-slate-950">Detalles del producto</h2>
            <dl className="mt-3 grid gap-2 text-[11px]">
              <div className="flex justify-between gap-3"><dt className="font-bold text-slate-600">Disponibilidad</dt><dd className="text-right text-slate-800">{product.stockLabel}</dd></div>
              <div className="flex justify-between gap-3"><dt className="font-bold text-slate-600">Condición</dt><dd className="text-right text-slate-800">{product.conditionLabel}</dd></div>
              <div className="flex justify-between gap-3"><dt className="font-bold text-slate-600">Compatibilidad</dt><dd className="text-right text-slate-800">{product.compatibilityLabel}</dd></div>
              <div className="flex justify-between gap-3"><dt className="font-bold text-slate-600">Garantía</dt><dd className="text-right text-slate-800">{product.warrantyLabel}</dd></div>
            </dl>
          </div>
          <div className="mt-5 border-t border-slate-200 pt-4"><h2 className="text-sm font-black text-slate-950">Sobre este producto</h2><p className="mt-2 text-[11px] leading-5 text-slate-600">{product.description}</p></div>
        </div>

        <aside className="rounded-xl border border-black/10 bg-white p-3 shadow-sm lg:sticky lg:top-24 lg:self-start" data-storefront-product-buy-box>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{detail.eyebrow}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-[var(--storefront-primary)] px-2.5 py-1 text-[10px] font-black text-[var(--storefront-on-primary)]">{product.badgeLabel}</span>
            <span className="rounded-full bg-[#f7f2ea] px-2.5 py-1 text-[10px] font-black text-slate-700">{product.stockLabel}</span>
          </div>
          <div className="mt-4 rounded-xl bg-[#f7f2ea] p-3">
            <p className="text-xl font-medium tracking-[-0.02em] text-slate-950">{product.priceLabel}</p>
            {product.compareLabel ? <p className="mt-1 text-xs font-black text-slate-600">{product.compareLabel}</p> : null}
          </div>

          <div className="mt-4 grid gap-2 text-xs font-bold text-slate-700">
            <p>{product.compatibilityLabel}</p>
            <p>{product.conditionLabel}</p>
            <p>{product.warrantyLabel}</p>
          </div>

          <div className="mt-4 grid gap-2" data-storefront-product-actions>
            <Link className="rounded-full bg-[var(--storefront-primary)] px-4 py-2.5 text-center text-xs font-black text-[var(--storefront-on-primary)] transition hover:bg-[var(--storefront-primary-strong)]" to="/store/contact">
              Consultar disponibilidad
            </Link>
            <button className="rounded-full border border-red-600 bg-white px-4 py-2 text-xs font-bold text-red-600 disabled:opacity-50" disabled={loading || busy} onClick={() => { void addToCart(); }} type="button">
              {busy ? 'Agregando…' : 'Agregar al carrito'}
            </button>
            {!customer && !loading && <p className="text-xs text-slate-500">Iniciá sesión para agregar al carrito.</p>}
            {notice && <p role="alert" className="text-xs text-red-700">{notice}</p>}
          </div>

        </aside>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
          <h2 className="text-lg font-black tracking-[-0.02em] text-slate-950">Descripción comercial</h2>
          <p className="mt-2 text-[11px] leading-4 text-slate-600">{product.description}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {product.highlights.map((highlight) => (
              <div key={highlight} className="rounded-xl bg-[#f7f2ea] p-3 text-xs font-bold leading-5 text-slate-700">
                {highlight}
              </div>
            ))}
          </div>
        </article>

        <aside className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
          <h2 className="text-base font-black text-slate-950">Ficha técnica</h2>
          <dl className="mt-3 grid gap-2">
            {product.specs.map((spec) => (
              <div key={spec.label} className="flex items-start justify-between gap-3 rounded-xl bg-[#f7f2ea] p-2.5">
                <dt className="text-xs font-normal text-slate-500">{spec.label}</dt>
                <dd className="text-right text-xs font-black text-slate-950">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section className="grid gap-3 md:grid-cols-2" aria-label="Avisos del producto">
        {product.notices.map((notice) => (
          <article key={notice.id} className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
            <p className="text-sm font-black text-slate-950">{notice.title}</p>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{notice.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
