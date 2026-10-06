import { Link } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import { StorefrontPageIntro } from './StorefrontPrimitives';

export function StorefrontContactPage({ provider }: { provider: StorefrontProvider }) {
  const contact = provider.getContactView();

  return (
    <main className="bg-[#f7f2ea]" data-storefront-contact>
      <section className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
        <StorefrontPageIntro
          eyebrow={contact.eyebrow}
          title={contact.title}
          description={contact.description}
          trailing={(
            <span className="inline-flex rounded-full border border-black/10 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
              {contact.stateLabel}
            </span>
          )}
        />

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-2" data-storefront-contact-channels>
              {contact.channels.map((channel) => (
                <article key={channel.id} className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-black text-slate-950">{channel.title}</h2>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
                      {channel.statusLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-slate-600">{channel.description}</p>
                  <button className="mt-4 cursor-not-allowed rounded-full border border-[var(--storefront-primary)] px-4 py-2 text-[11px] font-black text-[var(--storefront-primary-strong)]" disabled type="button">
                    {channel.actionLabel}
                  </button>
                </article>
              ))}
            </section>

            <section className="rounded-xl border border-black/10 bg-white p-3 shadow-sm" data-storefront-contact-topics>
              <h2 className="text-base font-black text-slate-950">¿En qué te ayudamos?</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {contact.topics.map((topic) => (
                  <article key={topic.id} className="rounded-xl bg-slate-50 p-3">
                    <h3 className="text-xs font-black text-slate-950">{topic.title}</h3>
                    <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{topic.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3" data-storefront-contact-notices>
              {contact.notices.map((notice) => (
                <article key={notice.id} className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
                  <h2 className="text-xs font-black text-slate-950">{notice.title}</h2>
                  <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{notice.description}</p>
                </article>
              ))}
            </section>
          </div>

          <aside className="h-fit rounded-xl border border-black/10 bg-white p-3 shadow-sm lg:sticky lg:top-24" data-storefront-contact-service>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--storefront-primary-strong)]">{contact.service.title}</p>
            <p className="mt-3 text-sm font-black text-slate-950">{contact.service.serviceAreaLabel}</p>
            <div className="mt-4 grid gap-2">
              {contact.service.hours.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between gap-3 border-b border-black/5 pb-2 text-[11px]">
                  <span className="font-bold text-slate-600">{slot.label}</span>
                  <span className="font-black text-slate-950">{slot.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-2">
              <Link className="flex items-center justify-center rounded-full bg-[var(--storefront-primary)] px-4 py-2 text-[11px] font-black text-[var(--storefront-on-primary)]" to={contact.links.productsHref}>
                {contact.links.productsLabel}
              </Link>
              <Link className="flex items-center justify-center rounded-full border border-black/10 px-4 py-2 text-[11px] font-black text-slate-700" to={contact.links.shippingHref}>
                {contact.links.shippingLabel}
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
