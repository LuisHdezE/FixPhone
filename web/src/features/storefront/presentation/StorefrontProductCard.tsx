import { Link } from 'react-router';
import type { StorefrontProductCardDto } from '../application/storefront.dto';
import { StorefrontIcon } from './StorefrontIcon';

export function StorefrontProductCard({ product, context }: { product: StorefrontProductCardDto; context: 'home' | 'listing' }) {
  const isListing = context === 'listing';
  return <article className="fp-product" data-storefront-listing-product-card={isListing ? '' : undefined} data-storefront-product-card={!isListing ? '' : undefined}>
    <Link to={product.href} className="fp-product-image-link" aria-label={`Ver ${product.title}`}>
      <img alt={product.image.alt} className="fp-product-image" loading="lazy" data-storefront-listing-product-image={isListing ? '' : undefined} data-storefront-product-image={!isListing ? '' : undefined} src={product.image.src} style={{ objectPosition: product.image.objectPosition ?? 'center' }} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/part-placeholder.svg'; }} />
      <span className="fp-product-badge">{product.badgeLabel}</span>
    </Link>
    <div className="fp-product-copy"><h3><Link to={product.href}>{product.title}</Link></h3><p>{product.compatibilityLabel}</p><p>{product.subtitle}</p><small>{product.stockLabel}</small></div>
    <div className="fp-product-bottom"><div><p className="fp-product-price">{product.priceLabel}</p>{product.compareLabel && <small>{product.compareLabel}</small>}</div><Link className="fp-product-view" to={product.href} aria-label={`Ver detalles de ${product.title}`}><StorefrontIcon name="arrow" /></Link></div>
  </article>;
}
