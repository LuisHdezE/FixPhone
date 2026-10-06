import { useRef, type CSSProperties } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import type { StorefrontProvider } from '@/features/storefront/application/storefront.contracts';
import { useStorefrontSession } from '@/features/storefront/presentation/useStorefrontSession';

function navClassName({ isActive }: { isActive: boolean }) {
  return `rounded-full px-3 py-1.5 text-xs font-semibold transition ${
    isActive
      ? 'bg-[var(--storefront-primary)] text-[var(--storefront-on-primary)]'
      : 'text-slate-700 hover:bg-[var(--storefront-primary-soft)] hover:text-[var(--storefront-primary-strong)]'
  }`;
}

export function StorefrontShell({ provider }: { provider: StorefrontProvider }) {
  const shell = provider.getShellView();
  const { customer, signOut } = useStorefrontSession();
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);
  const storefrontStyle = {
    '--storefront-primary': shell.theme.primary,
    '--storefront-primary-strong': shell.theme.primaryStrong,
    '--storefront-primary-soft': shell.theme.primarySoft,
    '--storefront-on-primary': shell.theme.onPrimary,
  } as CSSProperties;

  function closeMobileMenu() {
    mobileMenuRef.current?.removeAttribute('open');
  }

  return (
    <div className="min-h-dvh bg-[#f7f2ea] text-slate-900" data-storefront-shell style={storefrontStyle}>
      <div className="bg-[var(--storefront-primary-strong)] px-4 py-1 text-center text-[10px] font-semibold text-[var(--storefront-on-primary)] sm:text-xs" data-storefront-announcement>
        {shell.announcement}
      </div>

      <header className="sticky top-0 z-50 border-b border-black/10 bg-[#f7f2ea]/95 backdrop-blur">
        <div className="mx-auto grid max-w-[1440px] gap-1.5 px-4 py-1.5 sm:px-5 lg:px-6">
          <div className="grid gap-2 lg:grid-cols-[auto_minmax(18rem,1fr)_auto] lg:items-center">
            <div className="flex items-center justify-between gap-3">
              <Link className="flex min-w-0 items-center gap-2.5" to="/store" aria-label={`Inicio de ${shell.storeName}`}>
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[var(--storefront-primary)] text-xs font-black text-[var(--storefront-on-primary)] shadow-sm">
                  {shell.logoText}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black tracking-tight text-slate-950">{shell.storeName}</span>
                  <span className="hidden truncate text-[10px] text-slate-600 sm:block">{shell.storeTagline}</span>
                </span>
              </Link>

              <details ref={mobileMenuRef} className="relative lg:hidden">
                <summary className="cursor-pointer list-none rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-800 shadow-sm">
                  Menú
                </summary>
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-black/10 bg-white p-3 shadow-2xl">
                  <nav className="grid gap-1" aria-label="Navegación móvil de tienda">
                    {[...shell.primaryNav, ...shell.utilityNav].map((item) => (
                      <NavLink key={item.id} className={navClassName} to={item.href} onClick={closeMobileMenu}>
                        {item.label}
                      </NavLink>
                    ))}
                  </nav>
                </div>
              </details>
            </div>

            <label className="relative block" aria-label="Buscar en la tienda">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">⌕</span>
              <input
                aria-describedby="storefront-global-search-help"
                className="h-8 w-full cursor-not-allowed rounded-full border border-black/10 bg-white/70 px-8 text-[11px] font-medium text-slate-500 outline-none placeholder:text-slate-400"
                disabled
                placeholder={shell.searchPlaceholder}
                type="search"
              />
              <span id="storefront-global-search-help" className="sr-only">La búsqueda global se habilitará cuando el catálogo se conecte al inventario real.</span>
            </label>

            <nav className="hidden items-center justify-end gap-2 lg:flex" aria-label="Acciones de tienda">
              {shell.utilityNav.map((item) => (
                item.href === '/store/account' && customer ? (
                  <button key={item.id} className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm" data-storefront-session-shell onClick={signOut} type="button">
                    {customer.name} · Salir
                  </button>
                ) : (
                  <Link key={item.id} className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm transition hover:border-[var(--storefront-primary)] hover:text-[var(--storefront-primary-strong)]" to={item.href}>
                    {item.label}
                  </Link>
                )
              ))}
            </nav>
          </div>

          <div className="hidden items-center justify-between gap-3 lg:flex">
            <nav className="flex flex-wrap items-center gap-1" aria-label="Navegación principal de tienda">
              {shell.primaryNav.map((item) => (
                <NavLink key={item.id} className={navClassName} end={item.href === '/store'} to={item.href}>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Categorías destacadas">
              {shell.categoryNav.map((item) => (
                <Link key={item.id} className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-[var(--storefront-primary-soft)] hover:text-[var(--storefront-primary-strong)]" to={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="min-h-[60dvh]">
        <Outlet />
      </main>

      <footer className="border-t border-black/10 bg-[var(--storefront-primary-strong)] text-[var(--storefront-on-primary)]" data-storefront-footer>
        <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-5 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto] lg:px-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-xl bg-white text-xs font-black text-[var(--storefront-primary-strong)]">{shell.logoText}</span>
              <div>
                <p className="font-black">{shell.storeName}</p>
                <p className="text-[11px] text-white/80">{shell.support.serviceArea}</p>
              </div>
            </div>
            <Link className="mt-3 inline-flex rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[var(--storefront-primary-strong)] transition hover:bg-[var(--storefront-primary-soft)]" to={shell.support.whatsappHref}>
              {shell.support.whatsappLabel}
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {shell.footerColumns.map((column) => (
              <div key={column.id}>
                <p className="text-xs font-black uppercase tracking-[0.08em] text-white/80">{column.title}</p>
                <div className="mt-1.5 grid gap-1">
                  {column.links.map((link) => (
                    <Link key={link.id} className="text-xs text-white/80 transition hover:text-white" to={link.href}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </footer>

      <Link
        aria-label={shell.floatingAction.ariaLabel}
        className="fixed bottom-5 right-5 z-[60] grid size-12 place-items-center rounded-full shadow-xl ring-4 ring-white/80 transition hover:scale-105"
        data-storefront-floating-action
        style={{ backgroundColor: shell.floatingAction.backgroundColor, color: shell.floatingAction.foregroundColor }}
        title={shell.floatingAction.label}
        to={shell.floatingAction.href}
      >
        <svg aria-hidden="true" className="size-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a9.7 9.7 0 0 0-8.36 14.64L2.4 21.6l5.08-1.19A9.72 9.72 0 1 0 12 2Zm0 17.7a7.66 7.66 0 0 1-3.9-1.06l-.28-.16-3.02.7.74-2.94-.18-.3A7.7 7.7 0 1 1 12 19.7Zm4.22-5.76c-.23-.12-1.36-.67-1.57-.75-.21-.08-.36-.12-.52.12-.15.23-.59.75-.72.9-.13.16-.27.18-.5.06-.23-.12-.97-.36-1.85-1.14-.68-.61-1.15-1.36-1.28-1.59-.13-.23-.01-.35.1-.47.1-.1.23-.27.35-.4.11-.14.15-.23.23-.39.07-.15.04-.29-.02-.4-.06-.12-.52-1.25-.71-1.71-.19-.46-.38-.4-.52-.4h-.44c-.15 0-.4.06-.61.29-.21.23-.8.78-.8 1.9 0 1.12.82 2.2.93 2.35.12.15 1.61 2.46 3.9 3.45.55.24.97.38 1.3.49.55.17 1.04.15 1.44.09.44-.07 1.36-.56 1.55-1.09.19-.54.19-1 .13-1.09-.05-.1-.21-.16-.44-.27Z" />
        </svg>
        <span className="sr-only">{shell.floatingAction.label}</span>
      </Link>
    </div>
  );
}
