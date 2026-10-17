import { JsonStorefrontProvider } from './JsonStorefrontProvider';
import type { StorefrontProductCardDto, StorefrontProductDetailDto, StorefrontViewDto } from '../application/storefront.dto';

export type ApiStoreProduct = {
  id: string; title: string; description?: string | null; item_type: string;
  operational_status: string; sale_price_amount_minor: number; currency_code: string;
  stock_quantity: number; brand?: string | null; model?: string | null; main_image_url?: string | null;
  metadata?: { origin?: string | null; part_condition?: string | null };
};

export class ApiStorefrontProvider extends JsonStorefrontProvider {
  private cachedView?: StorefrontViewDto;

  constructor(private apiProducts: readonly ApiStoreProduct[]) { super(); }

  override getStorefrontView(): StorefrontViewDto {
    if (this.cachedView) return this.cachedView;
    const view = structuredClone(super.getStorefrontView());
    const cards: StorefrontProductCardDto[] = this.apiProducts.map((item, index) => {
      const phone = item.item_type === 'used_phone' || item.item_type === 'device';
      const recovered = item.metadata?.origin === 'recovered';
      const condition = phone ? (item.operational_status === 'reparado' ? 'Reacondicionado' : 'Usado') : recovered ? 'Usado recuperado' : item.metadata?.part_condition === 'functional' ? 'Funcional' : 'Repuesto';
      return {
        id: item.id, title: item.title, subtitle: condition, brandLabel: item.brand || undefined,
        priceLabel: new Intl.NumberFormat('es-UY', { style: 'currency', currency: item.currency_code || 'UYU' }).format(item.sale_price_amount_minor / 100),
        badgeLabel: condition, href: '/store/products/' + item.id,
        compatibilityLabel: [item.brand, item.model].filter(Boolean).join(' ') || 'Consultar compatibilidad',
        stockLabel: item.stock_quantity + (item.stock_quantity === 1 ? ' unidad disponible' : ' unidades disponibles'),
        image: { src: item.main_image_url || '/images/part-placeholder.svg', alt: item.title },
        discoveryFacets: { brand: item.brand?.toLowerCase() || 'other', category: phone ? 'phones' : 'parts', condition: recovered ? 'recovered' : phone ? 'used' : 'unspecified' },
        discoverySortRanks: { recommended: index, price_asc: item.sale_price_amount_minor, price_desc: -item.sale_price_amount_minor, newest: index },
      };
    });
    const details: StorefrontProductDetailDto[] = this.apiProducts.map((item, index) => {
      const card = cards[index]!;
      return {
        slug: item.id, title: card.title, subtitle: card.subtitle, badgeLabel: card.badgeLabel,
        priceLabel: card.priceLabel, stockLabel: card.stockLabel, compatibilityLabel: card.compatibilityLabel,
        conditionLabel: item.metadata?.part_condition === 'functional' ? 'Condición funcional declarada' : card.subtitle,
        warrantyLabel: 'Consultá las condiciones de garantía.', heroLabel: 'FixPhone',
        image: card.image, description: item.description || card.title,
        highlights: [card.compatibilityLabel, card.subtitle],
        specs: [{ label: 'Marca', value: item.brand || 'Consultar' }, { label: 'Modelo', value: item.model || 'Consultar' }, { label: 'Condición', value: card.subtitle }],
        gallery: [], notices: [], relatedProductSlugs: [],
      };
    });
    view.productListing.products = cards;
    view.productListing.filters = view.productListing.filters.map(filter => filter.id === 'condition' ? { ...filter, options: [{ id: 'all', label: 'Todos' }, { id: 'recovered', label: 'Usado recuperado' }, { id: 'used', label: 'Usado / reacondicionado' }, { id: 'unspecified', label: 'Otros repuestos' }] } : filter);
    view.productDetail.products = details;
    view.home.productSection.products = cards.slice(0, 8);
    view.catalog.routes = view.catalog.routes.map(route => ({ ...route, products: route.key === 'used-phones' ? cards.filter(card => card.discoveryFacets?.category === 'phones') : route.key === 'spare-parts' ? cards.filter(card => card.discoveryFacets?.category === 'parts') : cards }));
    this.cachedView = view;
    return view;
  }
}
