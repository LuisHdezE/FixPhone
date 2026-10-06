import { Link, useParams } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import { StorefrontPageIntro } from './StorefrontPrimitives';
import { StorefrontProductCard } from './StorefrontProductCard';

interface StorefrontCatalogPageProps {
  provider: StorefrontProvider;
  routeKey?: string;
}

export function StorefrontCatalogPage({ provider, routeKey }: StorefrontCatalogPageProps) {
  const { category } = useParams<{ category: string }>();
  const resolvedKey = routeKey ?? `category:${category ?? ''}`;
  const catalog = provider.getCatalogView();
  const view = provider.getCatalogRouteView(resolvedKey);

  if (!view) {
    return (
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-5 lg:px-6" data-storefront-catalog-not-found>
        <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-black text-slate-950">{catalog.notFound.title}</h1>
          <p className="mt-2 max-w-2xl text-[11px] leading-4 text-slate-600">{catalog.notFound.description}</p>
          <Link className="mt-4 inline-flex rounded-full bg-[var(--storefront-primary)] px-4 py-2 text-xs font-black text-[var(--storefront-on-primary)]" to={catalog.notFound.actionHref}>
            {catalog.notFound.actionLabel}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-[1440px] gap-3 px-4 py-3 sm:px-5 lg:px-6 lg:py-4" data-storefront-catalog-route data-storefront-catalog-route-key={view.key}>
      <section className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
        <StorefrontPageIntro
          eyebrow={view.eyebrow}
          title={view.title}
          description={view.description}
          trailing={(
            <span className="inline-flex rounded-full bg-[var(--storefront-primary-soft)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--storefront-primary-strong)]">
              {view.badgeLabel}
            </span>
          )}
        />

        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Rutas de catálogo" data-storefront-catalog-navigation>
          {catalog.navigation.map((item) => (
            <Link
              key={item.id}
              className="rounded-full border border-black/10 bg-[#f7f2ea] px-3 py-1.5 text-[11px] font-black text-slate-700 transition hover:border-[var(--storefront-primary)] hover:text-[var(--storefront-primary-strong)]"
              to={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </section>

      <section className="grid gap-3" data-storefront-catalog-products>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm font-black text-slate-950">{view.resultSummary}</p>
          <p className="text-[11px] font-bold text-slate-500">Datos del catálogo general · sin filtro de backend</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {view.products.map((product) => (
            <StorefrontProductCard key={product.id} context="listing" product={product} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-black/20 bg-white p-3" data-storefront-catalog-notice>
        <p className="text-sm font-black text-slate-950">{catalog.notice.title}</p>
        <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{catalog.notice.description}</p>
      </section>
    </main>
  );
}
