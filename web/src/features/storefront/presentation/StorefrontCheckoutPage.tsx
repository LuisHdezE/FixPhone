import { Link } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import { StorefrontPageIntro } from './StorefrontPrimitives';
import { useStorefrontSession } from './useStorefrontSession';

interface StorefrontCheckoutPageProps {
  provider: StorefrontProvider;
}

export function StorefrontCheckoutPage({ provider }: StorefrontCheckoutPageProps) {
  const checkout = provider.getCheckoutView();
  const { customer } = useStorefrontSession();

  return (
    <main className="bg-[#f7f2ea]" data-storefront-checkout>
      <section className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
        <StorefrontPageIntro
          eyebrow={checkout.eyebrow}
          title={checkout.title}
          description={checkout.description}
          trailing={(
            <span className="inline-flex w-fit rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700">
              {checkout.stateLabel}
            </span>
          )}
        />

        <section className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-3 sm:p-5" data-storefront-checkout-auth-gate data-storefront-checkout-authenticated={customer ? 'true' : 'false'}>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-700">{customer ? checkout.authGate.authenticatedEyebrow : checkout.authGate.eyebrow}</p>
          <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <h2 className="text-lg font-black text-slate-950">{customer ? checkout.authGate.authenticatedTitle : checkout.authGate.title}</h2>
              <p className="mt-1.5 max-w-3xl text-[11px] leading-4 text-slate-700">{customer ? checkout.authGate.authenticatedDescription : checkout.authGate.description}</p>
              <p className="mt-3 inline-flex rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-orange-800">
                {customer ? checkout.authGate.authenticatedLabel : checkout.authGate.requiredLabel}
              </p>
              {customer ? <p className="mt-2 text-[10px] font-bold text-slate-600" data-storefront-checkout-customer>{customer.name} · {customer.email}</p> : null}
            </div>
            {!customer ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link className="rounded-full bg-[var(--storefront-primary)] px-4 py-2.5 text-center text-xs font-black text-[var(--storefront-on-primary)]" to={checkout.authGate.signInHref}>
                  {checkout.authGate.signInLabel}
                </Link>
                <Link className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-center text-xs font-black text-slate-800" to={checkout.authGate.signUpHref}>
                  {checkout.authGate.signUpLabel}
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" data-storefront-checkout-shipping>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-950">{checkout.shipping.title}</h2>
                  <p className="mt-1.5 max-w-2xl text-[11px] leading-4 text-slate-600">{checkout.shipping.description}</p>
                </div>
                <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1.5 text-[10px] font-black text-slate-600">{checkout.shipping.statusLabel}</span>
              </div>
              <Link className="mt-3 inline-flex rounded-full border border-[var(--storefront-primary)] px-3 py-2 text-[11px] font-black text-[var(--storefront-primary-strong)]" to={checkout.shipping.actionHref}>
                {checkout.shipping.actionLabel}
              </Link>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {checkout.shipping.fields.map((field) => (
                  <article key={field.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{field.label}</p>
                    <p className="mt-1.5 text-sm font-black text-slate-950">{field.value}</p>
                    <p className="mt-1.5 text-[11px] leading-4 text-slate-500">{field.helper}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" data-storefront-checkout-payment>
              <h2 className="text-lg font-black text-slate-950">{checkout.payment.title}</h2>
              <p className="mt-1.5 max-w-2xl text-[11px] leading-4 text-slate-600">{checkout.payment.description}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {checkout.payment.options.map((option) => (
                  <article key={option.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-black text-slate-950">{option.title}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{option.statusLabel}</span>
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-slate-600">{option.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3" data-storefront-checkout-notices>
              {checkout.notices.map((notice) => (
                <article key={notice.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <h2 className="text-xs font-black text-slate-950">{notice.title}</h2>
                  <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{notice.description}</p>
                </article>
              ))}
            </section>
          </div>

          <aside className="h-fit rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-24" data-storefront-checkout-summary>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-700">{checkout.orderSummary.title}</p>
            <dl className="mt-4 space-y-3">
              {checkout.orderSummary.lines.map((line) => (
                <div key={line.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 text-xs">
                  <dt className="font-bold text-slate-600">{line.label}</dt>
                  <dd className="shrink-0 font-black text-slate-950">{line.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex items-end justify-between gap-3">
              <p className="text-xs font-bold text-slate-500">{checkout.orderSummary.totalLabel}</p>
              <p className="text-2xl font-black text-slate-950">{checkout.orderSummary.totalValue}</p>
            </div>
            <button className="mt-4 w-full cursor-not-allowed rounded-full bg-slate-300 px-4 py-2 text-[11px] font-black text-slate-600" disabled type="button">
              Confirmar compra pendiente
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}
