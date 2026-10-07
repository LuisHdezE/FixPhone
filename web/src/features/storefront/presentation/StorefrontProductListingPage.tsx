import { useMemo, useState } from 'react';
import type { StorefrontProvider } from '../application/storefront.contracts';
import { discoverStorefrontProducts } from '../application/storefront.discovery';
import { StorefrontPageIntro } from './StorefrontPrimitives';
import { StorefrontProductCard } from './StorefrontProductCard';

export function StorefrontProductListingPage({ provider }: { provider: StorefrontProvider }) {
  const listing = provider.getProductListingView();
  const [searchText, setSearchText] = useState('');
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
          trailing={(
            <div className="max-w-xs rounded-xl bg-slate-950 p-3 text-white" data-storefront-listing-notice>
              <p className="text-sm font-black">{listing.listingNotice.title}</p>
              <p className="mt-1.5 text-[11px] leading-4 text-white/70">{listing.listingNotice.description}</p>
            </div>
          )}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="grid gap-3 rounded-xl border border-black/10 bg-white p-3 shadow-sm lg:sticky lg:top-24 lg:self-start" data-storefront-listing-filters>
          <label className="grid gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">Búsqueda</span>
            <input
              aria-label="Buscar productos"
              className="h-10 rounded-xl border border-black/10 bg-[#f7f2ea] px-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-[var(--storefront-primary)] focus:ring-4 focus:ring-[var(--storefront-primary-soft)]"
              data-storefront-discovery-search
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={listing.searchPlaceholder}
              type="search"
              value={searchText}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">Orden</span>
            <select
              aria-label="Ordenar productos"
              className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-[var(--storefront-primary)] focus:ring-4 focus:ring-[var(--storefront-primary-soft)]"
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
              className="grid gap-2 border-t border-black/10 pt-3"
              data-storefront-discovery-filter={filter.id}
            >
              <legend className="text-sm font-black text-slate-950">{filter.title}</legend>
              <div className="grid gap-1.5">
                {filter.options.map((option) => {
                  const selectedValue = filterSelections[filter.id] ?? 'all';
                  const checked = selectedValue === option.id;

                  return (
                    <label
                      key={option.id}
                      className={[
                        'grid cursor-pointer gap-0.5 rounded-xl border p-2.5 text-xs transition',
                        checked
                          ? 'border-[var(--storefront-primary)] bg-[var(--storefront-primary-soft)]'
                          : 'border-black/10 hover:border-[var(--storefront-primary)]',
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-2 font-bold text-slate-800">
                        <input
                          checked={checked}
                          className="size-3.5 accent-slate-950"
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
                      {option.helper ? <span className="pl-5.5 text-[11px] leading-4 text-slate-500">{option.helper}</span> : null}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </aside>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 shadow-sm" data-storefront-discovery-summary>
            <div>
              <p className="text-sm font-black text-slate-950" data-storefront-discovery-count>
                {discovery.resultCount} de {listing.products.length} productos
              </p>
              <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                Búsqueda + {discovery.activeFilterCount} filtro{discovery.activeFilterCount === 1 ? '' : 's'} activo{discovery.activeFilterCount === 1 ? '' : 's'} · orden: {listing.sortOptions.find((option) => option.id === discovery.sortId)?.label ?? discovery.sortId}
              </p>
            </div>
            {discovery.hasActiveCriteria ? (
              <button
                className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 transition hover:border-[var(--storefront-primary)] hover:text-[var(--storefront-primary-strong)]"
                data-storefront-discovery-clear
                onClick={clearDiscovery}
                type="button"
              >
                Limpiar criterios
              </button>
            ) : null}
          </div>

          {discovery.resultCount > 0 ? (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Listado de productos" data-storefront-discovery-results>
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
