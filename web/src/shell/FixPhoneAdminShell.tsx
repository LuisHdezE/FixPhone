import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { fixPhoneNavigation } from '@/config/fixphoneNavigation';
import { ThemeColorPicker } from '@/theme/ThemeColorPicker';

function navClass({ isActive }: { isActive: boolean }) {
  return `block rounded-md px-2.5 py-1.5 text-[12px] font-medium transition ${isActive
    ? 'bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;
}

export function FixPhoneAdminShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigation = (
    <div className="space-y-4">
      {fixPhoneNavigation.map((group) => (
        <section key={group.label}>
          <p className="mb-1 px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{group.label}</p>
          <div className="grid gap-0.5">
            {group.items.map((item) => item.planned ? (
              <span key={item.label} className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] text-slate-400" title="Deuda funcional registrada">
                <span>{item.label}</span><span className="text-[9px] font-bold uppercase">Pendiente</span>
              </span>
            ) : (
              <NavLink key={item.to} className={navClass} to={item.to ?? '/'} onClick={() => setMobileOpen(false)}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <div className="min-h-dvh bg-[var(--surface-page)] text-slate-800">
      <header className="fixed inset-x-0 top-0 z-50 flex h-12 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-slate-200 px-2 py-1 text-xs md:hidden" onClick={() => setMobileOpen(true)} type="button">Menú</button>
          <Link className="flex items-center gap-2" to="/apps/inventory/dashboard">
            <span className="grid size-7 place-items-center rounded-lg bg-[var(--theme-primary)] text-[11px] font-black text-white">FP</span>
            <span className="text-sm font-black tracking-tight">FixPhone</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900" to="/store">Tienda online</Link>
          <ThemeColorPicker />
        </div>
      </header>

      <aside className="fixed bottom-0 left-0 top-12 hidden w-[232px] overflow-y-auto border-r border-slate-200 bg-white p-3 md:block">
        {navigation}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[60] bg-slate-950/30 md:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="h-full w-[286px] overflow-y-auto bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <strong>FixPhone</strong>
              <button className="text-xs text-slate-500" onClick={() => setMobileOpen(false)} type="button">Cerrar</button>
            </div>
            {navigation}
          </aside>
        </div>
      ) : null}

      <main className="min-h-dvh pt-12 md:pl-[232px]">
        <div className="min-h-[calc(100dvh-48px)] p-4 sm:p-[18px] lg:p-5">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
