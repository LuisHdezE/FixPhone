import type { StorefrontProductCardDto } from './storefront.dto';

export type StorefrontFavoriteIds = readonly string[];

export function getInitialFavoriteIds(
  products: readonly StorefrontProductCardDto[],
): StorefrontFavoriteIds {
  return products.map((product) => product.id);
}

export function removeFavorite(
  favoriteIds: StorefrontFavoriteIds,
  productId: string,
): StorefrontFavoriteIds {
  return favoriteIds.filter((id) => id !== productId);
}

export function restoreFavorites(
  products: readonly StorefrontProductCardDto[],
): StorefrontFavoriteIds {
  return getInitialFavoriteIds(products);
}

export function deriveFavoriteProducts(
  products: readonly StorefrontProductCardDto[],
  favoriteIds: StorefrontFavoriteIds,
): readonly StorefrontProductCardDto[] {
  const activeIds = new Set(favoriteIds);
  return products.filter((product) => activeIds.has(product.id));
}
