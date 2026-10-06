import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import {
  deriveFavoriteProducts,
  getInitialFavoriteIds,
  removeFavorite,
  restoreFavorites,
} from '../application/storefront.favorites';
import { StorefrontPageIntro } from './StorefrontPrimitives';
import { StorefrontProductCard } from './StorefrontProductCard';

export function StorefrontFavoritesPage({ provider }: { provider: StorefrontProvider }) {
  const favorites = provider.getFavoritesView();
  const initialFavoriteIds = useMemo(
    () => getInitialFavoriteIds(favorites.products),
    [favorites.products],
  );
  const [favoriteIds, setFavoriteIds] = useState(initialFavoriteIds);
  const visibleProducts = useMemo(
    () => deriveFavoriteProducts(favorites.products, favoriteIds),
    [favoriteIds, favorites.products],
  );

  const clearFavorites = () => setFavoriteIds([]);
  const restoreInitialFavorites = () => setFavoriteIds(restoreFavorites(favorites.products));

  return (
    <main className="bg-[#f7f2ea]" data-storefront-favorites>
      <section className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
        <StorefrontPageIntro
          eyebrow={favorites.eyebrow}
          title={favorites.title}
          description={favorites.description}
          trailing={(
            <span
              className="inline-flex rounded-full border border-black/10 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600"
              data-storefront-favorites-count
            >
              {visibleProducts.length} favorito{visibleProducts.length === 1 ? '' : 's'}
            </span>
          )}
        />

        {visibleProducts.length === 0 ? (
          <section className="mt-5 rounded-xl border border-dashed border-black/15 bg-white/70 p-3" data-storefront-favorites-empty-state>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-950">{favorites.emptyState.title}</h2>
                <p className="mt-1 text-[11px] leading-4 text-slate-600">{favorites.emptyState.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex w-fit rounded-full bg-[var(--storefront-primary)] px-4 py-2 text-xs font-black text-[var(--storefront-on-primary)]"
                  data-storefront-favorites-restore
                  onClick={restoreInitialFavorites}
                  type="button"
                >
                  Restaurar favoritos demo
                </button>
                <Link
                  className="inline-flex w-fit rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-black text-slate-700"
                  to={favorites.emptyState.actionHref}
                >
                  {favorites.emptyState.actionLabel}
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between gap-3 border-b border-black/10 pb-2">
              <p className="text-[10px] font-semibold text-slate-600" data-storefront-favorites-summary>
                {visibleProducts.length} de {favorites.products.length} productos guardados en memoria
              </p>
              <button
                className="text-[10px] font-black text-rose-600 hover:underline"
                data-storefront-favorites-clear
                onClick={clearFavorites}
                type="button"
              >
                Vaciar favoritos
              </button>
            </div>

            <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-storefront-favorites-products>
              {visibleProducts.map((product) => (
                <div key={product.id} className="grid gap-1.5" data-storefront-favorite-item data-storefront-favorite-id={product.id}>
                  <StorefrontProductCard context="listing" product={product} />
                  <button
                    className="justify-self-end text-[10px] font-black text-rose-600 hover:underline"
                    data-storefront-favorite-remove
                    onClick={() => setFavoriteIds((current) => removeFavorite(current, product.id))}
                    type="button"
                  >
                    Quitar de favoritos
                  </button>
                </div>
              ))}
            </section>
          </>
        )}

        <section className="mt-5 grid gap-3 sm:grid-cols-3" data-storefront-favorites-notices>
          {favorites.notices.map((notice) => (
            <article key={notice.id} className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
              <h2 className="text-xs font-black text-slate-950">{notice.title}</h2>
              <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{notice.description}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
