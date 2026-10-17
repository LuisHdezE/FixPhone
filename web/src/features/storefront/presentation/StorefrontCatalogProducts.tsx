import { useMemo, useState } from 'react';
import type { StorefrontProductCardDto } from '../application/storefront.dto';
import { discoverStorefrontProducts } from '../application/storefront.discovery';
import { StorefrontProductCard } from './StorefrontProductCard';

interface StorefrontCatalogProductsProps {
  catalogKey: string;
  products: readonly StorefrontProductCardDto[];
  pending?: boolean;
  error?: string;
  emptyMessage?: string;
}

function FilterMenu({ label, value, options, onChange, open, onToggle }: {
  label: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onChange: (value: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const selected = options.find((option) => option.id === value)?.label ?? value;
  return <div className="relative">
    <button type="button" className="flex h-8 items-center gap-2 border-b border-slate-300 bg-transparent px-1 text-[10px] font-medium text-slate-800 outline-none transition-colors hover:border-slate-500 focus:border-slate-400 focus:outline-none focus:ring-0" aria-haspopup="listbox" aria-expanded={open} onClick={onToggle} style={{ fontSize: '10px', lineHeight: '14px' }}>
      <span className="text-slate-500">{label}</span><span>{selected}</span><span aria-hidden="true" className="text-[10px]">⌄</span>
    </button>
    {open ? <div className="absolute right-0 z-20 mt-1 min-w-[150px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg" role="listbox" aria-label={label}>
      {options.map((option) => <button key={option.id} type="button" role="option" aria-selected={option.id === value} className={`block w-full rounded-md px-3 py-2 text-left text-[10px] transition-colors ${option.id === value ? 'bg-red-50 font-bold text-[var(--storefront-primary-strong)]' : 'text-slate-700 hover:bg-slate-50'}`} style={{ fontSize: '10px', lineHeight: '14px' }} onClick={() => { onChange(option.id); onToggle(); }}>{option.label}</button>)}
    </div> : null}
  </div>;
}


export function StorefrontCatalogProducts({
  catalogKey, products, pending = false, error = '', emptyMessage,
}: StorefrontCatalogProductsProps) {
  const [sortId, setSortId] = useState('recommended');
  const [brandId, setBrandId] = useState('all');
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const brands = useMemo(() => Array.from(new Map(products.map(product => [
    product.discoveryFacets?.brand ?? 'other',
    product.brandLabel ?? product.compatibilityLabel.split(' ')[0] ?? 'Otros',
  ] as const)).entries()), [products]);
  const result = useMemo(() => discoverStorefrontProducts(products, {
    searchText: '', sortId, filters: { brand: brandId },
  }), [products, sortId, brandId]);

  return <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-5 lg:px-6 lg:py-6" data-storefront-catalog-route data-storefront-catalog-route-key={catalogKey} data-parts-donor-catalog={catalogKey === 'for-parts' ? true : undefined}>
    <section className="grid gap-3" data-storefront-catalog-products>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3" data-storefront-catalog-filters>
        <span className="grid h-8 min-w-8 place-items-center rounded-full bg-slate-100 px-2 text-xs font-black text-slate-800">{result?.resultCount ?? 0}</span>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <FilterMenu label="Ordenar por" value={sortId} options={[{ id: 'recommended', label: 'Recomendados' }, { id: 'price_asc', label: 'Precio menor' }, { id: 'price_desc', label: 'Precio mayor' }]} onChange={setSortId} open={openFilter === 'sort'} onToggle={() => setOpenFilter(openFilter === 'sort' ? null : 'sort')} />
          <FilterMenu label="Marca" value={brandId} options={[{ id: 'all', label: 'Todas' }, ...brands.map(([id, label]) => ({ id, label }))]} onChange={setBrandId} open={openFilter === 'brand'} onToggle={() => setOpenFilter(openFilter === 'brand' ? null : 'brand')} />
        </div>
      </div>
      {pending ? <p className="text-xs text-slate-600" role="status">Consultando disponibilidad…</p> : null}
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800" role="alert">{error}</p> : null}
      {!pending && !error && result.resultCount === 0 && emptyMessage ? <p className="text-xs text-slate-600" role="status">{emptyMessage}</p> : null}
      <div className="grid content-start items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {!pending && !error && result.products.map((product) => <StorefrontProductCard key={product.id} context="listing" product={product} />)}
      </div>
    </section>
  </main>;
}