import { Link } from 'react-router';
import type { StorefrontProductCardDto } from '../application/storefront.dto';

interface StorefrontProductCardProps {
  product: StorefrontProductCardDto;
  context: 'home' | 'listing';
}

export function StorefrontProductCard({ product, context }: StorefrontProductCardProps) {
  const isListing = context === 'listing';

  return (
    <article
      className="group grid min-h-[360px] grid-rows-[auto_auto_1fr_auto] overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm"
      data-storefront-listing-product-card={isListing ? '' : undefined}
      data-storefront-product-card={!isListing ? '' : undefined}
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-3">
        <span className="rounded-full bg-[var(--storefront-primary)] px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[var(--storefront-on-primary)]">
          {product.badgeLabel}
        </span>
        <span className="max-w-[55%] text-right text-[10px] font-bold leading-4 text-slate-500">{product.stockLabel}</span>
      </div>

      <img
        alt={product.image.alt}
        className="mt-2 aspect-[4/3] w-full object-cover"
        data-storefront-listing-product-image={isListing ? '' : undefined}
        data-storefront-product-image={!isListing ? '' : undefined}
        src={product.image.src}
        style={{ objectPosition: product.image.objectPosition ?? 'center' }}
      />

      <div className="grid content-start gap-1.5 px-3 py-3">
        <p className="text-[10px] font-bold leading-4 text-slate-500">{product.compatibilityLabel}</p>
        <h3 className="text-sm font-black leading-5 tracking-[-0.015em] text-slate-950">{product.title}</h3>
        <p className="text-[11px] leading-4 text-slate-600">{product.subtitle}</p>
      </div>

      <div className="flex items-end justify-between gap-2 border-t border-black/5 px-3 py-3">
        <div className="min-w-0">
          <p className="text-lg font-black leading-none tracking-[-0.02em] text-slate-950">{product.priceLabel}</p>
          {product.compareLabel ? <p className="mt-1 text-[10px] leading-4 font-semibold text-slate-500">{product.compareLabel}</p> : null}
        </div>
        <Link
          className="shrink-0 rounded-full border border-[var(--storefront-primary)] px-3 py-1.5 text-[11px] font-black text-[var(--storefront-primary-strong)] transition hover:bg-[var(--storefront-primary-soft)]"
          to={product.href}
        >
          Ver
        </Link>
      </div>
    </article>
  );
}
