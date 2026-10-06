import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router';
import { AppIcon } from '@/components/AppIcon';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface PageShellProps extends PropsWithChildren {
  title: string;
  description: string;
  breadcrumbs: readonly BreadcrumbItem[];
  actions?: ReactNode;
}

export function PageShell({ title, description, breadcrumbs, actions, children }: PageShellProps) {
  return (
    <section className="mx-auto w-full max-w-[1600px]">
      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
        <Link className="transition hover:text-[var(--theme-primary)]" to="/dashboard">Inicio</Link>
        {breadcrumbs.map((item) => (
          <span key={`${item.to ?? 'current'}-${item.label}`} className="flex items-center gap-1">
            <span className="text-slate-300">/</span>
            {item.to ? (
              <Link className="transition hover:text-[var(--theme-primary)]" to={item.to}>{item.label}</Link>
            ) : (
              <span className="font-medium text-slate-700">{item.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">{title}</h1>
          <p className="mt-1 max-w-3xl text-[12px] leading-5 text-slate-500">{description}</p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      {children}
    </section>
  );
}

export function PendingViewCard() {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]">
          <AppIcon className="size-[18px]" name="layers" />
        </div>
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900">Vista preparada para construcción</h2>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500">
            La ruta ya forma parte del Blueprint navegable. Sus componentes se incorporarán por etapas y se reutilizarán en las vistas siguientes.
          </p>
        </div>
      </div>
    </div>
  );
}
