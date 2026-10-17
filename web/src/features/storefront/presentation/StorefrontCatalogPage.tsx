import { Link, useParams } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import { StorefrontCatalogProducts } from './StorefrontCatalogProducts';

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
    return <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-5 lg:px-6" data-storefront-catalog-not-found>
      <section className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-black text-slate-950">{catalog.notFound.title}</h1>
        <p className="mt-2 max-w-2xl text-[11px] leading-4 text-slate-600">{catalog.notFound.description}</p>
        <Link className="mt-4 inline-flex rounded-full bg-[var(--storefront-primary)] px-4 py-2 text-xs font-black text-[var(--storefront-on-primary)]" to={catalog.notFound.actionHref}>{catalog.notFound.actionLabel}</Link>
      </section>
    </main>;
  }

  return <StorefrontCatalogProducts key={view.key} catalogKey={view.key} products={view.products} />;
}
