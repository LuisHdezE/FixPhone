import rawCart from './storefront.cart.json';
import rawCatalog from './storefront.catalog.json';
import rawCheckout from './storefront.checkout.json';
import rawContact from './storefront.contact.json';
import rawIdentity from './storefront.identity.json';
import rawFavorites from './storefront.favorites.json';
import rawStorefront from './storefront.view.json';
import rawShipping from './storefront.shipping.json';
import rawWarranty from './storefront.warranty.json';
import type { StorefrontProvider } from '../application/storefront.contracts';
import type { StorefrontCartViewDto, StorefrontCatalogRouteViewDto, StorefrontCatalogViewDto, StorefrontCheckoutViewDto, StorefrontContactViewDto, StorefrontCustomerIdentityViewDto, StorefrontFavoritesViewDto, StorefrontHomeViewDto, StorefrontProductDetailDto, StorefrontProductDetailViewDto, StorefrontProductListingViewDto, StorefrontShellViewDto, StorefrontShippingViewDto, StorefrontViewDto, StorefrontWarrantyViewDto } from '../application/storefront.dto';

type RawStorefrontCatalogRoute = Omit<StorefrontCatalogRouteViewDto, 'products'> & {
  productIds: readonly string[];
};

type RawStorefrontCatalog = Omit<StorefrontCatalogViewDto, 'routes'> & {
  routes: readonly RawStorefrontCatalogRoute[];
};

export class JsonStorefrontProvider implements StorefrontProvider {
  getStorefrontView(): StorefrontViewDto {
    const listingProducts = (rawStorefront as Pick<StorefrontViewDto, 'productListing'>).productListing.products;
    const catalogConfig = rawCatalog as RawStorefrontCatalog;
    const catalog: StorefrontCatalogViewDto = {
      ...catalogConfig,
      routes: catalogConfig.routes.map(({ productIds, ...route }) => ({
        ...route,
        products: productIds
          .map((productId) => listingProducts.find((product) => product.id === productId))
          .filter((product): product is StorefrontProductListingViewDto['products'][number] => Boolean(product)),
      })),
    };

    const view = {
      ...(rawStorefront as Omit<StorefrontViewDto, 'cart' | 'checkout' | 'customerIdentity' | 'shipping' | 'favorites' | 'contact' | 'warranty' | 'catalog'>),
      cart: rawCart as StorefrontCartViewDto,
      catalog,
      checkout: rawCheckout as StorefrontCheckoutViewDto,
      contact: rawContact as StorefrontContactViewDto,
      customerIdentity: rawIdentity as StorefrontCustomerIdentityViewDto,
      favorites: rawFavorites as StorefrontFavoritesViewDto,
      shipping: rawShipping as StorefrontShippingViewDto,
      warranty: rawWarranty as StorefrontWarrantyViewDto,
    } as StorefrontViewDto;

    if (
      !view.shell?.storeName
      || !view.shell.primaryNav.length
      || !view.shell.categoryNav.length
      || !view.shell.theme?.primary
      || !view.shell.floatingAction?.href
      || !view.home?.title
      || !view.home.ctas.length
      || !view.home.heroBanners.length
      || !view.home.heroBanners.every((banner) => banner.image?.src && banner.image.alt)
      || !view.productListing?.title
      || !view.productListing.products.length
      || !view.productListing.filters.length
      || !view.catalog?.routes.length
      || !view.catalog.routes.every((route) => route.products.length)
      || !view.productDetail?.products.length
      || !view.productDetail.notFound.title
      || !view.cart?.title
      || !view.cart.emptyState.title
      || !view.cart.summary.items.length
      || !view.checkout?.title
      || !view.checkout.authGate.requiredLabel
      || !view.checkout.payment.options.length
      || !view.customerIdentity?.signIn.fields.length
      || !view.customerIdentity.register.fields.length
      || !view.shipping?.zones.length
      || !view.shipping.addressPreview.fields.length
      || !view.favorites?.products.length
      || !view.favorites.emptyState.title
      || !view.contact?.channels.length
      || !view.contact.service.hours.length
      || !view.warranty?.policies.length
      || !view.warranty.eligibility.rows.length
    ) {
      throw new Error('Storefront demo data is incomplete.');
    }
    return view;
  }

  getShellView(): StorefrontShellViewDto {
    return this.getStorefrontView().shell;
  }

  getHomeView(): StorefrontHomeViewDto {
    return this.getStorefrontView().home;
  }

  getProductListingView(): StorefrontProductListingViewDto {
    return this.getStorefrontView().productListing;
  }

  getCatalogView(): StorefrontCatalogViewDto {
    return this.getStorefrontView().catalog;
  }

  getCatalogRouteView(key: string): StorefrontCatalogRouteViewDto | undefined {
    return this.getCatalogView().routes.find((route) => route.key === key);
  }

  getProductDetailView(): StorefrontProductDetailViewDto {
    return this.getStorefrontView().productDetail;
  }

  getProductDetailBySlug(slug: string): StorefrontProductDetailDto | undefined {
    return this.getProductDetailView().products.find((product) => product.slug === slug);
  }

  getCartView(): StorefrontCartViewDto {
    return this.getStorefrontView().cart;
  }

  getCheckoutView(): StorefrontCheckoutViewDto {
    return this.getStorefrontView().checkout;
  }

  getCustomerIdentityView(): StorefrontCustomerIdentityViewDto {
    return this.getStorefrontView().customerIdentity;
  }

  getShippingView(): StorefrontShippingViewDto {
    return this.getStorefrontView().shipping;
  }

  getFavoritesView(): StorefrontFavoritesViewDto {
    return this.getStorefrontView().favorites;
  }

  getContactView(): StorefrontContactViewDto {
    return this.getStorefrontView().contact;
  }

  getWarrantyView(): StorefrontWarrantyViewDto {
    return this.getStorefrontView().warranty;
  }
}
