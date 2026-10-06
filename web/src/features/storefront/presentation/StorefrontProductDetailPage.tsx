import { Link, useParams } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';

function galleryClassName(tone: string) {
  if (tone === 'dark') return 'bg-slate-950 text-white';
  if (tone === 'warm') return 'bg-[#f7f2ea] text-slate-950';
  return 'bg-white text-slate-950';
}

export function StorefrontProductDetailPage({ provider }: { provider: StorefrontProvider }) {
  const { slug = '' } = useParams();
  const detail = provider.getProductDetailView();
  const product = provider.getProductDetailBySlug(slug);

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

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-3">
          <div className="grid min-h-[20rem] place-items-center rounded-xl border border-black/10 bg-white p-3 shadow-sm">
            <div className="grid aspect-[4/3] w-full max-w-[34rem] place-items-center rounded-xl bg-[#f7f2ea] p-3 text-center">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{product.heroLabel}</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">{product.badgeLabel}</p>
                <p className="mt-2 max-w-xs text-[11px] leading-4 text-slate-600">Imagen demo preparada para galería comercial futura</p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3" aria-label="Galería demo del producto">
            {product.gallery.map((item) => (
              <div key={item.id} className={`rounded-xl border border-black/10 p-3 text-xs font-black shadow-sm ${galleryClassName(item.tone)}`}>
                {item.label}
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-xl border border-black/10 bg-white p-3 shadow-sm lg:sticky lg:top-24 lg:self-start" data-storefront-product-buy-box>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{detail.eyebrow}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-[var(--storefront-primary)] px-2.5 py-1 text-[10px] font-black text-[var(--storefront-on-primary)]">{product.badgeLabel}</span>
            <span className="rounded-full bg-[#f7f2ea] px-2.5 py-1 text-[10px] font-black text-slate-700">{product.stockLabel}</span>
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-[-0.035em] text-slate-950">{product.title}</h1>
          <p className="mt-2 text-[11px] leading-4 text-slate-600">{product.subtitle}</p>

          <div className="mt-4 rounded-xl bg-[#f7f2ea] p-3">
            <p className="text-2xl font-black tracking-[-0.03em] text-slate-950">{product.priceLabel}</p>
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
            <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-[11px] font-black text-slate-400" disabled type="button">
              Carrito pendiente
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3" data-storefront-product-action-notice>
            <p className="text-xs font-black text-amber-950">{detail.actionNotice.title}</p>
            <p className="mt-1 text-[11px] leading-4 text-amber-900">{detail.actionNotice.description}</p>
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
          <h2 className="text-base font-black text-slate-950">Ficha técnica demo</h2>
          <dl className="mt-3 grid gap-2">
            {product.specs.map((spec) => (
              <div key={spec.label} className="flex items-start justify-between gap-3 rounded-xl bg-[#f7f2ea] p-2.5">
                <dt className="text-xs font-bold text-slate-500">{spec.label}</dt>
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
