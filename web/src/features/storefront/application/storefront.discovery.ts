import type { StorefrontProductCardDto } from './storefront.dto';

export type StorefrontProductDiscoveryFilters = Readonly<Record<string, string>>;

export interface StorefrontProductDiscoveryState {
  searchText: string;
  filters?: StorefrontProductDiscoveryFilters;
  sortId?: string;
}

export interface StorefrontProductDiscoveryResult {
  products: readonly StorefrontProductCardDto[];
  resultCount: number;
  hasActiveCriteria: boolean;
  activeFilterCount: number;
  sortId: string;
  hasCustomSort: boolean;
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

function getActiveFilters(filters: StorefrontProductDiscoveryFilters | undefined) {
  return Object.entries(filters ?? {}).filter(([, value]) => value && value !== 'all');
}

function getSortRank(product: StorefrontProductCardDto, sortId: string) {
  return product.discoverySortRanks?.[sortId] ?? Number.MAX_SAFE_INTEGER;
}

export function discoverStorefrontProducts(
  products: readonly StorefrontProductCardDto[],
  state: StorefrontProductDiscoveryState,
): StorefrontProductDiscoveryResult {
  const normalizedSearch = normalizeSearchValue(state.searchText);
  const searchTerms = normalizedSearch ? normalizedSearch.split(/\s+/) : [];
  const activeFilters = getActiveFilters(state.filters);
  const sortId = state.sortId || 'recommended';

  const matchedProducts = products.filter((product) => {
    const searchableValue = normalizeSearchValue([
      product.title,
      product.subtitle,
      product.compatibilityLabel,
      product.badgeLabel,
    ].join(' '));

    const matchesSearch = searchTerms.every((term) => searchableValue.includes(term));
    const matchesFilters = activeFilters.every(
      ([filterId, value]) => product.discoveryFacets?.[filterId] === value,
    );

    return matchesSearch && matchesFilters;
  });

  const sortedProducts = matchedProducts
    .map((product, sourceIndex) => ({ product, sourceIndex }))
    .sort((left, right) => {
      const rankDelta = getSortRank(left.product, sortId) - getSortRank(right.product, sortId);
      return rankDelta || left.sourceIndex - right.sourceIndex;
    })
    .map(({ product }) => product);

  return {
    products: sortedProducts,
    resultCount: sortedProducts.length,
    hasActiveCriteria: searchTerms.length > 0 || activeFilters.length > 0 || sortId !== 'recommended',
    activeFilterCount: activeFilters.length,
    sortId,
    hasCustomSort: sortId !== 'recommended',
  };
}
