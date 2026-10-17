import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import type { StorefrontHeroBannerDto } from '../application/storefront.dto';
import { StorefrontHeroCarousel } from './StorefrontHeroCarousel';
import { StorefrontProductCard } from './StorefrontProductCard';
import { StorefrontIcon } from './StorefrontIcon';

const categories = [
  { title: 'Celulares', href: '/store/used-phones', image: '/assets/store/phones.webp' },
  { title: 'Repuestos', href: '/store/spare-parts', image: '/assets/store/parts.webp' },
  { title: 'Reparaciones', href: '/store/contact', image: '/assets/login-fixphone.jpg' },
  { title: 'Accesorios', href: '/store/categories/accessories', image: '/assets/store/accessories.webp' },
];
export function StorefrontHomePage({ provider }: { provider: StorefrontProvider }) {
  const home = provider.getHomeView();
  const shell = provider.getShellView();
  const [campaigns, setCampaigns] = useState<StorefrontHeroBannerDto[] | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/v1/store/campaigns', { signal: abort.signal })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then((body: { data: { slides: StorefrontHeroBannerDto[] } | null }) => setCampaigns(body.data?.slides ?? null))
      .catch(() => { /* Bundled campaigns keep the storefront available. */ });
    return () => abort.abort();
  }, []);
  const products = provider.getProductListingView().products;
  const phones = products.filter(product => product.discoveryFacets?.category === 'phones' || product.discoveryFacets?.category === 'used-phones');
  const featured = phones.length ? phones.slice(0, 6) : products.slice(0, 6);
  return <div className="fp-home" data-storefront-home>
    <StorefrontHeroCarousel banners={campaigns ?? home.heroBanners} whatsappHref={shell.support.whatsappHref} />
    <section className="fp-container fp-section">
      <div className="fp-section-heading"><h2>Categorías</h2><Link to="/store/products">Ver todas <span aria-hidden="true">›</span></Link></div>
      <div className="fp-categories">{categories.map(category => <Link className="fp-category" to={category.href} key={category.title}><img src={category.image} alt="" loading="lazy" /><span>{category.title}<span aria-hidden="true">›</span></span></Link>)}</div>
    </section>
    <section className="fp-container fp-section" data-storefront-featured>
      <div className="fp-section-heading"><h2>{phones.length ? 'Celulares destacados' : 'Productos destacados'}</h2><Link to={phones.length ? '/store/used-phones' : '/store/products'}>Ver todos <span aria-hidden="true">›</span></Link></div>
      {featured.length ? <div className="fp-featured-grid">{featured.map(product => <StorefrontProductCard key={product.id} product={product} context="home" />)}</div> : <div className="fp-empty"><p>Estamos preparando nuevos productos.</p><a href={shell.support.whatsappHref}>Consultanos por WhatsApp</a></div>}
    </section>
    <section className="fp-container fp-section"><div className="fp-donor-band"><div><p className="fp-eyebrow">Equipos para repuestos</p><h2>Encontrá la pieza que necesitás</h2><p>Celulares con fallas, vendidos por unidad. Consultá su estado y los componentes disponibles.</p></div><Link to="/store/for-parts">Ver equipos <StorefrontIcon name="arrow" /></Link></div></section>
  </div>;
}
