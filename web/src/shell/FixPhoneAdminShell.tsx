import { useEffect, useState } from 'react';
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
  const navigate = useNavigate();

  // Escape key closes mobile navigation
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const toggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileOpen((prev) => !prev);
    } else {
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
                      onClick={onItemClick}
                      className={({ isActive }) => `
                        group relative mx-auto grid size-9 place-items-center rounded-md text-[12px] font-medium transition
                        ${isActive
                          ? 'bg-[var(--theme-primary-soft)] text-[var(--theme-primary)] font-semibold shadow-xs ring-1 ring-[var(--theme-primary)]/20'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                      `}
                    >
                      <AppIcon className="size-4 shrink-0" name={item.icon} />
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute left-full ml-2.5 z-50 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-xl opacity-0 invisible -translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:visible group-focus-visible:translate-x-0"
                      >
                        {item.label}
                      </span>
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
            aria-controls="fixphone-sidebar-navigation"
            aria-expanded={mobileOpen || !isCollapsed}
            aria-label={isCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
            title={isCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
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
        className={`fixed bottom-0 left-0 top-11 z-20 hidden overflow-y-auto border-r border-slate-200 bg-white transition-[width,padding] duration-200 ease-in-out md:block ${
          isCollapsed ? 'w-14 p-2' : 'w-[216px] p-2.5'
        }`}
      >
        {renderNavItems(isCollapsed)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-xs transition-opacity md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
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
                aria-label="Cerrar navegación"
                className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
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
