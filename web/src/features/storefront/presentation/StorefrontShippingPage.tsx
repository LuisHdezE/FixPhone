import { Link } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import { StorefrontPageIntro } from './StorefrontPrimitives';

export function StorefrontShippingPage({ provider }: { provider: StorefrontProvider }) {
  const shipping = provider.getShippingView();

  return (
    <main className="bg-[#f7f2ea]" data-storefront-shipping>
      <section className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
        <StorefrontPageIntro
          eyebrow={shipping.eyebrow}
          title={shipping.title}
          description={shipping.description}
          trailing={(
            <span className="inline-flex rounded-full border border-black/10 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
              {shipping.stateLabel}
            </span>
          )}
        />

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-3">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-storefront-shipping-zones>
              {shipping.zones.map((zone) => (
                <article key={zone.id} className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
                  <span className="inline-flex rounded-full bg-[var(--storefront-primary-soft)] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--storefront-primary-strong)]">
                    {zone.coverageLabel}
                  </span>
                  <h2 className="mt-3 text-sm font-black text-slate-950">{zone.name}</h2>
                  <p className="mt-1.5 min-h-12 text-[11px] leading-4 text-slate-600">{zone.description}</p>
                  <p className="mt-3 text-base font-black text-slate-950">{zone.priceLabel}</p>
                  <p className="mt-1 text-[10px] font-bold text-slate-500">{zone.etaLabel}</p>
                  <button className="mt-3 w-full cursor-not-allowed rounded-full border border-[var(--storefront-primary)] px-3 py-2 text-[11px] font-black text-[var(--storefront-primary-strong)]" disabled type="button">
                    Selección pendiente
                  </button>
                </article>
              ))}
            </section>

            <section className="rounded-xl border border-[var(--storefront-primary)] bg-[var(--storefront-primary-soft)] p-3" data-storefront-shipping-pickup>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-950">{shipping.pickup.title}</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-600">{shipping.pickup.description}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-lg font-black text-[var(--storefront-primary-strong)]">{shipping.pickup.priceLabel}</p>
                  <p className="text-[10px] font-bold text-slate-500">{shipping.pickup.etaLabel}</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-black/10 bg-white p-3 shadow-sm" data-storefront-shipping-address>
              <h2 className="text-base font-black text-slate-950">{shipping.addressPreview.title}</h2>
              <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{shipping.addressPreview.description}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {shipping.addressPreview.fields.map((field) => (
                  <label key={field.id} className="block">
                    <span className="text-[11px] font-black text-slate-700">{field.label}</span>
                    <input
                      className="mt-1.5 h-10 w-full cursor-not-allowed rounded-xl border border-black/10 bg-slate-50 px-3 text-xs text-slate-500"
                      disabled
                      placeholder={field.placeholder}
                      type="text"
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3" data-storefront-shipping-notices>
              {shipping.notices.map((notice) => (
                <article key={notice.id} className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
                  <h2 className="text-xs font-black text-slate-950">{notice.title}</h2>
                  <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{notice.description}</p>
                </article>
              ))}
            </section>
          </div>

          <aside className="h-fit rounded-xl border border-black/10 bg-white p-3 shadow-sm lg:sticky lg:top-24" data-storefront-shipping-summary>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--storefront-primary-strong)]">Estado del envío</p>
            <p className="mt-3 text-sm font-black text-slate-950">Tarifa visible en modo de muestra</p>
            <p className="mt-2 text-[11px] leading-4 text-slate-600">
              Las zonas muestran importes de referencia. El método de entrega quedará asociado al pedido cuando el checkout quede conectado al servicio de pedidos.
            </p>
            <Link className="mt-4 flex w-full items-center justify-center rounded-full bg-[var(--storefront-primary)] px-4 py-2 text-[11px] font-black text-[var(--storefront-on-primary)]" to={shipping.returnToCheckoutHref}>
              {shipping.returnToCheckoutLabel}
            </Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
