import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, NavLink, Outlet } from 'react-router';
import { endAdminSession } from '@/auth/adminApiSession';
import type { AdminPrincipal } from '@/auth/AuthenticatedAdminShell';
import { AppIcon } from '@/components/AppIcon';
import { fixPhoneNavigation } from '@/config/fixphoneNavigation';
import { ThemeColorPicker } from '@/theme/ThemeColorPicker';

const SIDEBAR_STORAGE_KEY = 'fixphone.sidebar.collapsed';

export function FixPhoneAdminShell({ principal }: { principal: AdminPrincipal }) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  const [activeTooltip, setActiveTooltip] = useState<{ text: string; top: number } | null>(null);

  const hamburgerButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const navigate = useNavigate();

  // Track viewport breakpoint for responsive attributes
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Manage focus, Escape key and focus trap for mobile drawer
  useEffect(() => {
    if (mobileOpen) {
      previousFocusRef.current = (document.activeElement as HTMLElement) || hamburgerButtonRef.current;

      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          setMobileOpen(false);
          return;
        }

        if (e.key === 'Tab' && drawerRef.current) {
          const focusable = Array.from(
            drawerRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => el.offsetParent !== null);

          if (focusable.length === 0) {
            e.preventDefault();
            return;
          }

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (!first || !last) {
            e.preventDefault();
            return;
          }

          if (e.shiftKey) {
            if (document.activeElement === first || !drawerRef.current.contains(document.activeElement)) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last || !drawerRef.current.contains(document.activeElement)) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        previousFocusRef.current?.focus();
      };
    }
  }, [mobileOpen]);

  const toggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileOpen((prev) => !prev);
    } else {
      setActiveTooltip(null);
      setIsCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
        } catch {
          // Ignore localStorage errors
        }
        return next;
      });
    }
  };

  async function logout() {
    try {
      await endAdminSession();
    } finally {
      navigate('/authentication/sign-in');
    }
  }

  const renderNavItems = (collapsed: boolean, onItemClick?: () => void) => (
    <div className={collapsed ? 'space-y-3' : 'space-y-3.5'}>
      {fixPhoneNavigation.map((group, groupIndex) => {
        const activeItems = group.items.filter((item) => !item.planned);
        if (activeItems.length === 0) return null;

        return (
          <section key={group.label} aria-label={group.label}>
            {collapsed ? (
              groupIndex > 0 ? (
                <div
                  aria-hidden="true"
                  className="mx-auto my-2 h-px w-6 bg-slate-200"
                  title={group.label}
                />
              ) : null
            ) : (
              <p className="mb-1 truncate px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                {group.label}
              </p>
            )}

            <div className={collapsed ? 'grid gap-1' : 'grid gap-0.5'}>
              {activeItems.map((item) => {
                if (collapsed) {
                  return (
                    <NavLink
                      key={item.to}
                      end={Boolean(item.exact)}
                      to={item.to ?? '/'}
                      title={item.label}
                      onClick={() => {
                        setActiveTooltip(null);
                        onItemClick?.();
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({ text: item.label, top: rect.top + rect.height / 2 });
                      }}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onFocus={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveTooltip({ text: item.label, top: rect.top + rect.height / 2 });
                      }}
                      onBlur={() => setActiveTooltip(null)}
                      className={({ isActive }) => `
                        relative mx-auto grid size-9 place-items-center rounded-md text-[12px] font-medium transition
                        ${isActive
                          ? 'bg-[var(--theme-primary-soft)] text-[var(--theme-primary)] font-semibold shadow-xs ring-1 ring-[var(--theme-primary)]/20'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                      `}
                    >
                      <AppIcon className="size-4 shrink-0" name={item.icon} />
                    </NavLink>
                  );
                }

                return (
                  <NavLink
                    key={item.to}
                    end={Boolean(item.exact)}
                    to={item.to ?? '/'}
                    onClick={onItemClick}
                    className={({ isActive }) => `
                      flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium transition
                      ${isActive
                        ? 'bg-[var(--theme-primary-soft)] text-[var(--theme-primary)] font-semibold shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                    `}
                  >
                    <AppIcon className="size-4 shrink-0" name={item.icon} />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-dvh bg-[var(--surface-page)] text-slate-800">
      {/* Topbar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-11 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            ref={hamburgerButtonRef}
            aria-controls={isMobile ? 'fixphone-mobile-navigation' : 'fixphone-sidebar-navigation'}
            aria-expanded={isMobile ? mobileOpen : !isCollapsed}
            aria-label={
              isMobile
                ? mobileOpen
                  ? 'Cerrar navegación móvil'
                  : 'Abrir navegación móvil'
                : isCollapsed
                  ? 'Expandir barra lateral'
                  : 'Contraer barra lateral'
            }
            title={
              isMobile
                ? mobileOpen
                  ? 'Cerrar menú'
                  : 'Abrir menú'
                : isCollapsed
                  ? 'Expandir barra lateral'
                  : 'Contraer barra lateral'
            }
            className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
            onClick={toggleSidebar}
            type="button"
          >
            <AppIcon className="size-4" name="menu" />
          </button>
          <Link className="flex items-center gap-2" to="/apps/inventory/dashboard">
            <span className="grid size-7 place-items-center rounded-md bg-[var(--theme-primary)] text-[11px] font-black text-white">FP</span>
            <span className="text-sm font-black tracking-tight">FixPhone</span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            to="/store"
            aria-label="Abrir tienda online"
            title="Tienda online"
          >
            <AppIcon className="size-4" name="store" />
          </Link>
          <button
            className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            type="button"
            aria-label="Notificaciones"
            title="Notificaciones"
          >
            <AppIcon className="size-4" name="bell" />
          </button>
          <ThemeColorPicker />
          <details className="relative">
            <summary
              className="grid size-8 cursor-pointer list-none place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label={'Menú de usuario: ' + principal.name}
            >
              <AppIcon className="size-4" name="user" />
            </summary>
            <div className="absolute right-0 top-10 z-[60] w-48 rounded-md border border-slate-200 bg-white py-1 text-[12px] text-slate-700 shadow-xl">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="truncate text-xs font-semibold text-slate-900">{principal.name}</p>
                <p className="truncate text-[11px] text-slate-500">{principal.email}</p>
              </div>
              <Link className="block px-3 py-1.5 hover:bg-slate-50" to="/user/profile">
                Perfil
              </Link>
              <Link className="block px-3 py-1.5 hover:bg-slate-50" to="/user/account-settings">
                Configuración
              </Link>
              <button
                className="block w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50"
                type="button"
                onClick={() => void logout()}
              >
                Cerrar sesión
              </button>
            </div>
          </details>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside
        id="fixphone-sidebar-navigation"
        aria-label="Navegación principal"
        onScroll={() => setActiveTooltip(null)}
        className={`fixed bottom-0 left-0 top-11 z-20 hidden overflow-y-auto border-r border-slate-200 bg-white transition-[width,padding] duration-200 ease-in-out md:block ${
          isCollapsed ? 'w-14 p-2' : 'w-[216px] p-2.5'
        }`}
      >
        {renderNavItems(isCollapsed)}
      </aside>

      {/* Floating Tooltip outside aside to prevent clipping by overflow-y-auto */}
      {activeTooltip && isCollapsed ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-xl"
          style={{ left: 62, top: activeTooltip.top }}
        >
          {activeTooltip.text}
        </div>
      ) : null}

      {/* Mobile Drawer Overlay */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-xs transition-opacity md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            ref={drawerRef}
            aria-label="Navegación móvil"
            className="h-full w-[260px] max-w-[85vw] overflow-y-auto bg-white p-3 shadow-2xl transition-transform"
            id="fixphone-mobile-navigation"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded bg-[var(--theme-primary)] text-[10px] font-black text-white">FP</span>
                <strong className="text-sm font-bold text-slate-900">FixPhone</strong>
              </div>
              <button
                ref={closeButtonRef}
                aria-label="Cerrar navegación"
                className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
                onClick={() => setMobileOpen(false)}
                type="button"
              >
                <AppIcon className="size-3.5" name="x" />
              </button>
            </div>
            {renderNavItems(false, () => setMobileOpen(false))}
          </aside>
        </div>
      ) : null}

      {/* Main Content Area */}
      <main
        className={`min-h-dvh pt-11 transition-[padding-left] duration-200 ease-in-out ${
          isCollapsed ? 'md:pl-14' : 'md:pl-[216px]'
        }`}
      >
        <div className="min-h-[calc(100dvh-44px)] p-3 lg:p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
