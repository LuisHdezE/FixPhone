import { JsonStorefrontProvider } from './JsonStorefrontProvider';
import type { StorefrontMediaDto, StorefrontProductCardDto, StorefrontProductDetailDto, StorefrontViewDto } from '../application/storefront.dto';

export type ApiStoreProduct = {
  id: string; title: string; description?: string | null; item_type: string;
  operational_status: string; sale_price_amount_minor: number; currency_code: string;
  stock_quantity: number; brand?: string | null; model?: string | null; main_image_url?: string | null;
  photos?: readonly { id: string | number; url: string; is_primary: boolean; type?: 'real_photo' | 'advertisement' }[];
  promotional_assets?: readonly { id: string | number; url: string; is_primary?: boolean; type?: 'real_photo' | 'advertisement'; prompt_code?: string }[];
  gallery?: readonly { id: string | number; url: string; is_primary?: boolean; type?: 'real_photo' | 'advertisement'; prompt_code?: string }[];
  metadata?: { origin?: string | null; part_condition?: string | null; reference_price_minor?: number | null; reference_currency?: string | null; is_original?: boolean };
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
      const realPhotos = (item.photos?.filter(p => p.type !== 'advertisement') ?? item.gallery?.filter(g => g.type !== 'advertisement') ?? [])
        .filter(p => p.url && p.type !== 'advertisement');
      const primaryRealPhoto = realPhotos.find(p => p.is_primary) ?? realPhotos[0];
      const cardImageSrc = primaryRealPhoto?.url || item.main_image_url || '/images/part-placeholder.svg';
      return {
        id: item.id, title: item.title, subtitle: condition, brandLabel: item.brand || undefined,
        referencePriceLabel: item.item_type === 'spare_part' && item.metadata?.reference_price_minor ? new Intl.NumberFormat('es-UY', { style: 'currency', currency: item.metadata.reference_currency || item.currency_code || 'UYU' }).format(item.metadata.reference_price_minor / 100) : undefined,
        originalLabel: item.item_type === 'spare_part' && item.metadata?.is_original ? 'Original' : undefined,
        priceLabel: new Intl.NumberFormat('es-UY', { style: 'currency', currency: item.currency_code || 'UYU' }).format(item.sale_price_amount_minor / 100),
        badgeLabel: condition, href: '/store/products/' + item.id,
        compatibilityLabel: [item.brand, item.model].filter(Boolean).join(' ') || 'Consultar compatibilidad',
        stockLabel: item.stock_quantity + (item.stock_quantity === 1 ? ' unidad disponible' : ' unidades disponibles'),
        image: { src: cardImageSrc, alt: item.title, type: 'real_photo' },
        discoveryFacets: { brand: item.brand?.toLowerCase() || 'other', category: phone ? 'phones' : 'parts', condition: recovered ? 'recovered' : phone ? 'used' : 'unspecified' },
        discoverySortRanks: { recommended: index, price_asc: item.sale_price_amount_minor, price_desc: -item.sale_price_amount_minor, newest: index },
      };
    });
    const details: StorefrontProductDetailDto[] = this.apiProducts.map((item, index) => {
      const card = cards[index]!;
      const realPhotos = (item.photos?.filter(p => p.type !== 'advertisement') ?? item.gallery?.filter(g => g.type !== 'advertisement') ?? [])
        .filter(p => p.url && p.type !== 'advertisement');
      const approvedAds = (item.promotional_assets ?? item.gallery?.filter(g => g.type === 'advertisement') ?? [])
        .filter(a => a.url && a.type === 'advertisement');

      const realMediaList: StorefrontMediaDto[] = realPhotos.length > 0
        ? realPhotos.map((photo, photoIndex) => ({
            src: photo.url,
            alt: card.title + ' · foto ' + (photoIndex + 1),
            type: 'real_photo',
            is_primary: Boolean(photo.is_primary),
          }))
        : [{ ...card.image, type: 'real_photo' }];

      const adMediaList: StorefrontMediaDto[] = approvedAds.map((ad, adIndex) => ({
        src: ad.url,
        alt: card.title + ' · publicidad ' + (adIndex + 1),
        type: 'advertisement',
        is_primary: false,
      }));

      const productImages: readonly StorefrontMediaDto[] = approvedAds.length > 0
        ? [...realMediaList, ...adMediaList]
        : (realPhotos.length > 0 ? realMediaList : [card.image]);

      return {
        slug: item.id, title: card.title, subtitle: card.subtitle, badgeLabel: card.badgeLabel,
        priceLabel: card.priceLabel, stockLabel: card.stockLabel, compatibilityLabel: card.compatibilityLabel,
        conditionLabel: item.metadata?.part_condition === 'functional' ? 'Condición funcional declarada' : card.subtitle,
        warrantyLabel: 'Consultá las condiciones de garantía.', heroLabel: 'FixPhone',
        image: card.image,
        images: productImages,
        description: item.description || card.title,
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
