import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import type { StorefrontProvider } from '@/features/storefront/application/storefront.contracts';
import { useStorefrontSession } from '@/features/storefront/presentation/useStorefrontSession';
import { StorefrontIcon } from '@/features/storefront/presentation/StorefrontIcon';
import '@/styles/storefront.css';

const navigation = [
  { title: 'Celulares', href: '/store/used-phones' }, { title: 'Repuestos', href: '/store/spare-parts' },
  { title: 'Reparaciones', href: '/store/contact' }, { title: 'Para repuestos', href: '/store/for-parts' },
];
export function StorefrontShell({ provider }: { provider: StorefrontProvider }) {
  const shell = provider.getShellView();
  const { customer, signOut } = useStorefrontSession();
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const storefrontStyle = {
    '--storefront-primary': shell.theme.primary, '--storefront-primary-strong': shell.theme.primaryStrong,
    '--storefront-primary-soft': shell.theme.primarySoft, '--storefront-on-primary': shell.theme.onPrimary,
  } as CSSProperties;
  function searchProducts(event: FormEvent) { event.preventDefault(); navigate('/store/products?q=' + encodeURIComponent(search.trim())); }
  return <div className="fp-store min-h-dvh bg-white text-slate-900" data-storefront-shell style={storefrontStyle}>
    <a className="fp-skip" href="#store-content">Ir al contenido</a>
    <header className="fp-header"><div className="fp-container fp-header-inner">
      <Link className="fp-logo" to="/store" aria-label={`Inicio de ${shell.storeName}`}><StorefrontIcon name="phone" /><span><strong><span>Fix</span>Phone</strong><small>CELULARES · REPUESTOS · REPARACIONES</small></span></Link>
      <nav className="fp-desktop-nav" aria-label="Navegación principal de tienda">{navigation.map(item => <NavLink key={item.href} to={item.href}>{item.title}</NavLink>)}</nav>
      <form className="fp-search" role="search" onSubmit={searchProducts}><StorefrontIcon name="search" /><input aria-label="Buscar en la tienda" type="search" placeholder="Buscar productos..." value={search} onChange={event => setSearch(event.target.value)} /><button type="submit" className="sr-only">Buscar</button></form>
      <nav className="fp-utility" aria-label="Acciones de tienda">
        {customer ? <button aria-label={`Cerrar sesión de ${customer.name}`} title={`${customer.name} · Salir`} data-storefront-session-shell onClick={signOut}><StorefrontIcon name="user" /></button> : <Link to="/store/account" aria-label="Mi cuenta"><StorefrontIcon name="user" /></Link>}
        <Link to="/store/favorites" aria-label="Favoritos"><StorefrontIcon name="heart" /></Link>
        <Link to="/store/cart" aria-label="Carrito"><StorefrontIcon name="cart" /></Link>
      </nav>
      <details ref={mobileMenuRef} className="fp-mobile-menu"><summary aria-label="Abrir menú"><StorefrontIcon name="menu" /></summary><nav aria-label="Navegación móvil de tienda">{navigation.map(item => <Link key={item.href} to={item.href} onClick={() => mobileMenuRef.current?.removeAttribute('open')}>{item.title}</Link>)}</nav></details>
    </div></header>
    <main id="store-content" className="min-h-[60dvh]"><Outlet /></main>
    <footer className="fp-footer" data-storefront-footer><div className="fp-container fp-footer-grid">
      <div><Link className="fp-footer-logo" to="/store">{shell.storeName}</Link><p>{shell.support.serviceArea}</p><a className="fp-footer-contact" href={shell.support.whatsappHref} target="_blank" rel="noopener noreferrer">{shell.support.whatsappLabel}</a></div>
      {shell.footerColumns.map(column => <div key={column.id}><strong>{column.title}</strong>{column.links.map(link => <Link key={link.id} to={link.href}>{link.label}</Link>)}</div>)}
    </div></footer>
    <a aria-label="Consultar por WhatsApp" className="fp-whatsapp" data-storefront-floating-action href={shell.support.whatsappHref} target="_blank" rel="noopener noreferrer"><StorefrontIcon name="chat" /></a>
  </div>;
}
