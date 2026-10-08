import { JsonStorefrontProvider } from './JsonStorefrontProvider';
import type { StorefrontViewDto } from '../application/storefront.dto';

export class ApiStorefrontProvider extends JsonStorefrontProvider {
  private cachedView?: StorefrontViewDto;

  constructor(private apiProducts: any[]) {
    super();
  }

  override getStorefrontView(): StorefrontViewDto {
    if (this.cachedView) return this.cachedView;

    const view = JSON.parse(JSON.stringify(super.getStorefrontView())) as StorefrontViewDto;


    const mappedProducts: any[] = this.apiProducts.map(apiItem => {
      const isUsedPhone = apiItem.item_type === 'used_phone';
      const condition = apiItem.operational_status === 'reparado' ? 'Reacondicionado' : 'Nuevo';
      const formattedPrice = '$ ' + (apiItem.sale_price_amount_minor || 0).toLocaleString('es-UY');

      return {
        id: apiItem.id,
        title: apiItem.title,
        subtitle: isUsedPhone ? condition : 'Repuesto',
        priceLabel: formattedPrice,
        badgeLabel: isUsedPhone ? 'Testeado' : 'Nuevo',
        href: `/store/products/${apiItem.id}`,
        compatibilityLabel: apiItem.brand && apiItem.model ? `${apiItem.brand} ${apiItem.model}` : 'Universal',
        stockLabel: apiItem.stock_quantity > 0 ? 'En Stock' : 'Agotado',
        image: {
          src: apiItem.main_image_url || 'https://placehold.co/400x400/eeeeee/999999?text=Sin+Imagen',
          alt: apiItem.title
        },
        discoveryFacets: {
          brand: apiItem.brand?.toLowerCase() || 'other',
          category: isUsedPhone ? 'phones' : 'parts',
          condition: isUsedPhone ? 'refurbished' : 'new'
        },
        discoverySortRanks: {
          recommended: 1,
          price_asc: apiItem.sale_price_amount_minor || 0,
          price_desc: -(apiItem.sale_price_amount_minor || 0),
          newest: 1
        }
      };
    });

    view.productListing.products = mappedProducts;

    view.catalog.routes = view.catalog.routes.map(route => {
      if (route.key === 'used-phones') {
         return {
           ...route,
           products: mappedProducts.filter(p => p.discoveryFacets.category === 'phones')
         };
      }
      if (route.key === 'spare-parts') {
         return {
           ...route,
           products: mappedProducts.filter(p => p.discoveryFacets.category === 'parts')
         };
      }
      if (route.key === 'brands') {
        return {
           ...route,
           products: []
        };
      }
      return route;
    });

    this.cachedView = view;
    return view;
  }
}
