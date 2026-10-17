import { Link } from 'react-router';
import type { StorefrontProductCardDto } from '../application/storefront.dto';
import { StorefrontIcon } from './StorefrontIcon';

export function StorefrontProductCard({ product, context }: { product: StorefrontProductCardDto; context: 'home' | 'listing' }) {
  const isListing = context === 'listing';
  const brand = product.brandLabel || product.compatibilityLabel.split(' ')[0] || 'FIXPHONE';
  return <article className="fp-product" data-storefront-listing-product-card={isListing ? '' : undefined} data-storefront-product-card={!isListing ? '' : undefined}>
    <Link to={product.href} className="fp-product-image-link" aria-label={`Ver ${product.title}`}>
      <img alt={product.image.alt} className="fp-product-image" loading="lazy" data-storefront-listing-product-image={isListing ? '' : undefined} data-storefront-product-image={!isListing ? '' : undefined} src={product.image.src} style={{ objectPosition: product.image.objectPosition ?? 'center' }} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/part-placeholder.svg'; }} />
    </Link>
    <div className="fp-product-copy">
      <p className="fp-product-brand">{brand}</p>
      <h3><Link to={product.href}>{product.title}</Link></h3>
      <p className="fp-product-description">{product.compatibilityLabel}{product.subtitle ? ` · ${product.subtitle}` : ''}</p>
      <div className="fp-product-meta"><span className="fp-product-badge">{product.badgeLabel}</span>{product.originalLabel ? <span className="fp-product-original">{product.originalLabel}</span> : null}<small>{product.stockLabel}</small></div>
      <p className="fp-product-installments">¡Comprá en hasta 12 cuotas sin interés con todas tus tarjetas!</p>
    </div>
    <div className="fp-product-bottom"><div><p className="fp-product-price">{product.priceLabel}</p>{product.referencePriceLabel ? <small className="fp-product-reference">Nuevo en tienda: {product.referencePriceLabel}</small> : product.compareLabel && <small>{product.compareLabel}</small>}</div><Link className="fp-product-view" to={product.href} aria-label={`Ver detalles de ${product.title}`}><StorefrontIcon name="arrow" /></Link></div>
  </article>;
}
