import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import { discoverStorefrontProducts } from '../application/storefront.discovery';
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
  const [sortId, setSortId] = useState('recommended');
  const [brandId, setBrandId] = useState('all');

  const brands = useMemo(() => Array.from(new Map(
    view?.products
      .map((product) => [product.discoveryFacets?.brand ?? 'other', product.brandLabel ?? product.compatibilityLabel.split(' ')[0] ?? 'Otros'] as const) ?? [],
  ).entries()), [view]);

  const result = useMemo(() => view ? discoverStorefrontProducts(view.products, {
    searchText: '',
    sortId,
    filters: { brand: brandId },
  }) : null, [view, sortId, brandId]);

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
    <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-5 lg:px-6 lg:py-6" data-storefront-catalog-route data-storefront-catalog-route-key={view.key}>
      <section className="grid gap-3" data-storefront-catalog-products>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3" data-storefront-catalog-filters>
          <span className="grid h-8 min-w-8 place-items-center rounded-full bg-slate-100 px-2 text-xs font-black text-slate-800">{result?.resultCount ?? 0}</span>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <span className="hidden sm:inline">Ordenar por</span>
              <select className="h-8 min-w-[132px] appearance-none border-0 border-b border-slate-300 bg-transparent px-1 text-xs font-semibold text-slate-800 outline-none ring-0 focus:border-slate-400 focus:bg-transparent focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0" aria-label="Ordenar productos" value={sortId} onChange={(event) => setSortId(event.target.value)}>
                <option value="recommended">Recomendados</option>
                <option value="price_asc">Precio menor</option>
                <option value="price_desc">Precio mayor</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <span className="hidden sm:inline">Marca</span>
              <select className="h-8 min-w-[112px] appearance-none border-0 border-b border-slate-300 bg-transparent px-1 text-xs font-semibold text-slate-800 outline-none ring-0 focus:border-slate-400 focus:bg-transparent focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0" aria-label="Filtrar por marca" value={brandId} onChange={(event) => setBrandId(event.target.value)}>
                <option value="all">Todas</option>
                {brands.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result?.products.map((product) => <StorefrontProductCard key={product.id} context="listing" product={product} />)}
        </div>
      </section>
    </main>
  );
}
