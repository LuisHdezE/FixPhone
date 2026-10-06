import { Link } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import { StorefrontPageIntro } from './StorefrontPrimitives';

export function StorefrontWarrantyPage({ provider }: { provider: StorefrontProvider }) {
  const warranty = provider.getWarrantyView();

  return (
    <main className="bg-[#f7f2ea]" data-storefront-warranty>
      <section className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
        <StorefrontPageIntro
          eyebrow={warranty.eyebrow}
          title={warranty.title}
          description={warranty.description}
          trailing={(
            <span className="inline-flex rounded-full border border-black/10 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
              {warranty.stateLabel}
            </span>
          )}
        />

        <section className="mt-5 grid gap-3 lg:grid-cols-2" data-storefront-warranty-policies>
          {warranty.policies.map((policy) => (
            <article key={policy.id} className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
              <span className="inline-flex rounded-full bg-[var(--storefront-primary-soft)] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--storefront-primary-strong)]">
                {policy.badgeLabel}
              </span>
              <h2 className="mt-3 text-base font-black text-slate-950">{policy.title}</h2>
              <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{policy.description}</p>
              <ul className="mt-4 grid gap-2">
                {policy.items.map((item) => (
                  <li key={item} className="flex gap-2 text-[11px] leading-4 text-slate-700">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--storefront-primary)]" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded-xl border border-black/10 bg-white p-3 shadow-sm" data-storefront-warranty-eligibility>
            <h2 className="text-base font-black text-slate-950">{warranty.eligibility.title}</h2>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{warranty.eligibility.description}</p>
            <div className="mt-4 grid gap-2">
              {warranty.eligibility.rows.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <span className="text-[11px] font-bold text-slate-600">{row.label}</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">{row.value}</span>
                </div>
              ))}
            </div>
            <button className="mt-4 cursor-not-allowed rounded-full border border-[var(--storefront-primary)] px-4 py-2 text-[11px] font-black text-[var(--storefront-primary-strong)]" disabled type="button">
              {warranty.eligibility.actionLabel}
            </button>
          </section>

          <aside className="h-fit rounded-xl border border-black/10 bg-white p-3 shadow-sm lg:sticky lg:top-24">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--storefront-primary-strong)]">Siguientes pasos</p>
            <p className="mt-3 text-sm font-black text-slate-950">¿Necesitas ayuda con un producto?</p>
            <p className="mt-2 text-[11px] leading-4 text-slate-600">Usa el canal de soporte para aclarar cobertura o vuelve al catálogo.</p>
            <div className="mt-4 grid gap-2">
              <Link className="flex items-center justify-center rounded-full bg-[var(--storefront-primary)] px-4 py-2 text-[11px] font-black text-[var(--storefront-on-primary)]" to={warranty.links.contactHref}>
                {warranty.links.contactLabel}
              </Link>
              <Link className="flex items-center justify-center rounded-full border border-black/10 px-4 py-2 text-[11px] font-black text-slate-700" to={warranty.links.productsHref}>
                {warranty.links.productsLabel}
              </Link>
            </div>
          </aside>
        </div>

        <section className="mt-5 grid gap-3 sm:grid-cols-3" data-storefront-warranty-notices>
          {warranty.notices.map((notice) => (
            <article key={notice.id} className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
              <h2 className="text-xs font-black text-slate-950">{notice.title}</h2>
              <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{notice.description}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
