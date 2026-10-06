import { useState } from 'react';
import { Link } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import type { StorefrontCategoryCardDto } from '../application/storefront.dto';
import { StorefrontSectionIntro } from './StorefrontPrimitives';
import { StorefrontProductCard } from './StorefrontProductCard';

function CategoryCard({ category }: { category: StorefrontCategoryCardDto }) {
  return (
    <Link
      className="group grid min-h-40 content-between rounded-xl border border-black/10 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--storefront-primary)] hover:shadow-md"
      to={category.href}
    >
      <span>
        <span className="rounded-full bg-[var(--storefront-primary-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--storefront-primary-strong)]">
          {category.eyebrow}
        </span>
        <span className="mt-3 block text-base font-black tracking-[-0.02em] text-slate-950">{category.title}</span>
        <span className="mt-1.5 block text-[11px] leading-4 text-slate-600">{category.description}</span>
      </span>
      <span className="mt-3 flex items-center justify-between gap-3 text-xs font-black text-[var(--storefront-primary-strong)]">
        <span>{category.itemCountLabel}</span>
        <span aria-hidden="true" className="transition group-hover:translate-x-1">→</span>
      </span>
    </Link>
  );
}

export function StorefrontHomePage({ provider }: { provider: StorefrontProvider }) {
  const home = provider.getHomeView();
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const activeBanner = home.heroBanners[activeBannerIndex] ?? home.heroBanners[0];

  if (!activeBanner) return null;

  function moveBanner(direction: -1 | 1) {
    setActiveBannerIndex((current) => {
      const next = current + direction;
      if (next < 0) return home.heroBanners.length - 1;
      if (next >= home.heroBanners.length) return 0;
      return next;
    });
  }

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-4 sm:px-5 lg:px-6 lg:py-5" data-storefront-home>
      <section className="relative overflow-hidden rounded-xl border border-black/10 bg-slate-100 shadow-sm" data-storefront-hero-carousel>
        <div className="relative min-h-[260px] sm:min-h-[320px] lg:min-h-[360px]">
          <img
            alt={activeBanner.image.alt}
            className="absolute inset-0 h-full w-full object-cover"
            data-storefront-hero-image
            src={activeBanner.image.src}
            style={{ objectPosition: activeBanner.image.objectPosition ?? 'center' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/10" />
          <div className="relative z-10 flex min-h-[260px] max-w-2xl flex-col justify-center px-8 py-8 text-white sm:min-h-[320px] sm:px-12 lg:min-h-[360px] lg:px-14">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">{activeBanner.eyebrow}</p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-2xl">{activeBanner.title}</h1>
            <p className="mt-3 max-w-xl text-[11px] leading-4 text-white/85">{activeBanner.description}</p>
            <Link
              className="mt-5 inline-flex w-fit rounded-full bg-[var(--storefront-primary)] px-5 py-2 text-[11px] font-black text-[var(--storefront-on-primary)] transition hover:bg-[var(--storefront-primary-strong)]"
              to={activeBanner.actionHref}
            >
              {activeBanner.actionLabel}
            </Link>
          </div>

          <button
            aria-label="Banner anterior"
            className="absolute left-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-xl bg-white/95 text-base font-black text-slate-800 shadow-md transition hover:bg-white"
            type="button"
            onClick={() => moveBanner(-1)}
          >
            ‹
          </button>
          <button
            aria-label="Banner siguiente"
            className="absolute right-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-xl bg-white/95 text-base font-black text-slate-800 shadow-md transition hover:bg-white"
            type="button"
            onClick={() => moveBanner(1)}
          >
            ›
          </button>

          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2" aria-label="Selector de banners">
            {home.heroBanners.map((banner, index) => (
              <button
                key={banner.id}
                aria-label={`Mostrar banner ${index + 1}`}
                className={`h-2.5 rounded-full transition-all ${index === activeBannerIndex ? 'w-7 bg-white' : 'w-2.5 bg-white/55'}`}
                type="button"
                onClick={() => setActiveBannerIndex(index)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3" aria-label="Base Storefront B1">
        {home.featureTiles.map((tile) => (
          <article key={tile.id} className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
            <p className="text-sm font-black text-slate-950">{tile.title}</p>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{tile.description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3" data-storefront-category-section>
        <StorefrontSectionIntro {...home.categorySection} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {home.categorySection.categories.map((category) => <CategoryCard key={category.id} category={category} />)}
        </div>
      </section>

      <section className="grid gap-3" data-storefront-product-section>
        <StorefrontSectionIntro {...home.productSection} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {home.productSection.products.map((product) => <StorefrontProductCard key={product.id} context="home" product={product} />)}
        </div>
      </section>

      <section className="rounded-xl bg-[var(--storefront-primary-strong)] p-3 text-[var(--storefront-on-primary)] sm:p-6" data-storefront-promo-band>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/70">{home.promoBand.eyebrow}</p>
            <h2 className="mt-1.5 max-w-3xl text-lg font-black tracking-[-0.03em] sm:text-2xl">{home.promoBand.title}</h2>
            <p className="mt-2 max-w-2xl text-[11px] leading-4 text-white/85">{home.promoBand.description}</p>
          </div>
          <Link className="rounded-full bg-white px-4 py-2 text-xs font-black text-[var(--storefront-primary-strong)] transition hover:bg-[var(--storefront-primary-soft)]" to={home.promoBand.actionHref}>
            {home.promoBand.actionLabel}
          </Link>
        </div>
      </section>
    </div>
  );
}
