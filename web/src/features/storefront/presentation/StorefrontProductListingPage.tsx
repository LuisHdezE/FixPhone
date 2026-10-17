import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import { discoverStorefrontProducts } from '../application/storefront.discovery';
import { StorefrontPageIntro } from './StorefrontPrimitives';
import { StorefrontProductCard } from './StorefrontProductCard';
import { StorefrontDiscoverySummary } from './StorefrontDiscoverySummary';

export function StorefrontProductListingPage({ provider }: { provider: StorefrontProvider }) {
  const listing = provider.getProductListingView();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchText = searchParams.get('q') ?? '';
  const setSearchText = (value: string) => setSearchParams(current => { const next = new URLSearchParams(current); if (value) next.set('q', value); else next.delete('q'); return next; }, { replace: true });
  const [filterSelections, setFilterSelections] = useState<Record<string, string>>({});
  const [sortId, setSortId] = useState('recommended');
  const discovery = useMemo(
    () => discoverStorefrontProducts(listing.products, { searchText, filters: filterSelections, sortId }),
    [filterSelections, listing.products, searchText, sortId],
  );

  const clearDiscovery = () => {
    setSearchText('');
    setFilterSelections({});
    setSortId('recommended');
  };

  return (
    <div className="mx-auto grid max-w-[1440px] gap-3 px-4 py-3 sm:px-5 lg:px-6 lg:py-4" data-storefront-product-listing>
      <section className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
        <StorefrontPageIntro
          eyebrow={listing.eyebrow}
          title={listing.title}
          description={listing.description}

        />
      </section>

      <section className="grid items-start gap-3 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="fp-discovery-filters grid gap-2 rounded-lg border border-black/10 bg-white p-2 shadow-sm lg:sticky lg:top-24 lg:self-start" data-storefront-listing-filters>
          <label className="grid gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-500">Búsqueda</span>
            <input
              aria-label="Buscar productos"
              className="h-8 rounded-md border border-black/10 bg-[#f7f2ea] px-2 text-[11px] font-normal text-slate-900 outline-none placeholder:text-slate-400 focus:border-[var(--storefront-primary)] focus:ring-4 focus:ring-[var(--storefront-primary-soft)]"
              data-storefront-discovery-search
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={listing.searchPlaceholder}
              type="search"
              value={searchText}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-500">Orden</span>
            <select
              aria-label="Ordenar productos"
              className="h-8 appearance-none rounded-md border border-black/10 bg-white px-2 text-[11px] font-normal text-slate-900 outline-none focus:border-slate-300 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
              data-storefront-discovery-sort
              onChange={(event) => setSortId(event.target.value)}
              value={sortId}
            >
              {listing.sortOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          {listing.filters.map((filter) => (
            <fieldset
              key={filter.id}
              className="grid gap-1.5 border-t border-black/10 pt-2"
              data-storefront-discovery-filter={filter.id}
            >
              <legend className="text-[11px] font-semibold text-slate-950">{filter.title}</legend>
              {filter.id === 'brand' ? (
                <select
                  aria-label="Filtrar por marca"
                  className="h-8 w-full appearance-none rounded-md border border-black/10 bg-white px-2 text-[11px] font-normal text-slate-800 outline-none focus:border-slate-300 focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                  data-storefront-discovery-brand
                  onChange={(event) => setFilterSelections((current) => ({
                    ...current,
                    [filter.id]: event.target.value,
                  }))}
                  value={filterSelections[filter.id] ?? 'all'}
                >
                  {filter.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              ) : (
                <div className="grid gap-1.5">
                  {filter.options.map((option) => {
                    const selectedValue = filterSelections[filter.id] ?? 'all';
                    const checked = selectedValue === option.id;

                    return (
                      <label
                        key={option.id}
                        className={[
                          'grid cursor-pointer gap-0.5 rounded-md border px-2 py-1.5 text-[11px] transition',
                          checked
                            ? 'border-[var(--storefront-primary)] bg-[var(--storefront-primary-soft)]'
                            : 'border-black/10 hover:border-[var(--storefront-primary)]',
                        ].join(' ')}
                      >
                        <span className="flex items-center gap-1.5 font-medium leading-4 text-slate-800">
                          <input
                            checked={checked}
                            className="size-3 accent-slate-950"
                            name={filter.id}
                            onChange={() => setFilterSelections((current) => ({
                              ...current,
                              [filter.id]: option.id,
                            }))}
                            type="radio"
                            value={option.id}
                          />
                          {option.label}
                        </span>
                        {option.helper ? <span className="pl-[18px] text-[10px] leading-3.5 text-slate-500">{option.helper}</span> : null}
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
          ))}
        </aside>

        <div className="flex min-w-0 flex-col gap-3" data-storefront-discovery-content>
          <StorefrontDiscoverySummary
            resultCount={discovery.resultCount}
            totalCount={listing.products.length}
            activeFilterCount={discovery.activeFilterCount}
            sortLabel={listing.sortOptions.find((option) => option.id === discovery.sortId)?.label ?? discovery.sortId}
            hasActiveCriteria={discovery.hasActiveCriteria}
            onClear={clearDiscovery}
          />

          {discovery.resultCount > 0 ? (
            <section className="grid content-start items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Listado de productos" data-storefront-discovery-results>
              {discovery.products.map((product) => (
                <StorefrontProductCard key={product.id} context="listing" product={product} />
              ))}
            </section>
          ) : (
            <section className="rounded-xl border border-dashed border-black/20 bg-white p-3" data-storefront-listing-empty-state>
              <p className="text-sm font-black text-slate-950">{listing.emptyState.title}</p>
              <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{listing.emptyState.description}</p>
              <button
                className="mt-3 rounded-full bg-[var(--storefront-primary)] px-3 py-1.5 text-[11px] font-black text-[var(--storefront-on-primary)]"
                onClick={clearDiscovery}
                type="button"
              >
                Limpiar criterios
              </button>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
