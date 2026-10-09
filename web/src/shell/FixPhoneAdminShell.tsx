import { useState } from 'react';
import { useNavigate } from 'react-router';
import { endAdminSession } from '@/auth/adminApiSession';
import { Link, NavLink, Outlet } from 'react-router';
import { AppIcon } from '@/components/AppIcon';
import { fixPhoneNavigation } from '@/config/fixphoneNavigation';
import { ThemeColorPicker } from '@/theme/ThemeColorPicker';
function navClass({ isActive }: { isActive: boolean }) {
  return `flex items-center rounded-md px-2 py-1.5 text-[12px] font-medium transition ${isActive
    ? 'bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;
}
export function FixPhoneAdminShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  async function logout() {
    try { await endAdminSession(); } finally { navigate('/authentication/sign-in'); }
  }
  const navigation = (
    <div className="space-y-3">
      {fixPhoneNavigation.map((group) => {
        const activeItems = group.items.filter((item) => !item.planned);
        if (activeItems.length === 0) return null;
        return (
          <section key={group.label}>
            <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{group.label}</p>
            <div className="grid gap-0.5">
              {activeItems.map((item) => (
                <NavLink key={item.to} className={navClass} to={item.to ?? '/'} onClick={() => setMobileOpen(false)}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
  return (
    <div className="min-h-dvh bg-[var(--surface-page)] text-slate-800">
      <header className="fixed inset-x-0 top-0 z-50 flex h-11 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            aria-controls="fixphone-mobile-navigation"
            aria-expanded={mobileOpen}
            aria-label="Abrir navegaci+¦n principal"
            className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-600 md:hidden"
            onClick={() => setMobileOpen(true)}
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
          <Link className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900" to="/store" aria-label="Abrir tienda online" title="Tienda online">
            <AppIcon className="size-4" name="store" />
          </Link>
          <button className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900" type="button" aria-label="Notificaciones" title="Notificaciones">
            <AppIcon className="size-4" name="bell" />
          </button>
          <ThemeColorPicker />
          <details className="relative">
            <summary className="grid size-8 cursor-pointer list-none place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900" aria-label="Men+¦ de usuario">
              <AppIcon className="size-4" name="user" />
            </summary>
            <div className="absolute right-0 top-10 z-[70] w-44 rounded-md border border-slate-200 bg-white py-1 text-[12px] text-slate-700 shadow-xl">
              <Link className="block px-3 py-1.5 hover:bg-slate-50" to="/user/profile">Perfil</Link>
              <Link className="block px-3 py-1.5 hover:bg-slate-50" to="/user/account-settings">Configuraci+¦n</Link>
              <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-50" type="button" onClick={() => void logout()}>Cerrar sesión</button>
            </div>
          </details>
        </div>
      </header>
      <aside className="fixed bottom-0 left-0 top-11 hidden w-[216px] overflow-y-auto border-r border-slate-200 bg-white p-2.5 md:block">
        {navigation}
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-[60] bg-slate-950/30 md:hidden" onClick={() => setMobileOpen(false)}>
          <aside
            aria-label="Navegaci+¦n principal"
            className="h-full w-[280px] overflow-y-auto bg-white p-3 shadow-2xl"
            id="fixphone-mobile-navigation"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="mb-3 flex items-center justify-between">
              <strong>FixPhone</strong>
              <button aria-label="Cerrar navegaci+¦n principal" className="text-xs text-slate-500" onClick={() => setMobileOpen(false)} type="button">Cerrar</button>
            </div>
            {navigation}
          </aside>
        </div>
      ) : null}
      <main className="min-h-dvh pt-11 md:pl-[216px]">
        <div className="min-h-[calc(100dvh-44px)] p-3 lg:p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
