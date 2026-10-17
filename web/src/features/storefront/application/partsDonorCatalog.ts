import type { PublicPartsDonor } from './partsDonor.types';
import { partsDonorPrice } from './partsDonor.types';
import type { StorefrontProductCardDto } from './storefront.dto';

export function partsDonorCatalogCards(items: readonly PublicPartsDonor[]): StorefrontProductCardDto[] {
  return items
    .filter(item => item.category === 'phones_for_parts' && item.availability === 'available')
    .map((item, index) => ({
      id: item.id,
      title: item.model_name,
      subtitle: item.fault_label,
      brandLabel: item.brand?.trim() || 'Sin marca',
      priceLabel: partsDonorPrice(item.price_minor),
      badgeLabel: 'Para repuestos',
      href: item.href,
      compatibilityLabel: item.model_name,
      stockLabel: '1 unidad disponible',
      image: { src: item.image_url || '/images/part-placeholder.svg', alt: item.title },
      discoveryFacets: {
        brand: item.brand?.trim().toLocaleLowerCase('es') || 'other',
        category: 'phones_for_parts',
      },
      discoverySortRanks: {
        recommended: index, price_asc: item.price_minor, price_desc: -item.price_minor,
      },
    }));
}
