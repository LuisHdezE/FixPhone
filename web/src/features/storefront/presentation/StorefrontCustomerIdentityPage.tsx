import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { StorefrontProvider } from '../application/storefront.contracts';
import { createStorefrontCustomerSession } from '../application/storefront.session';
import { StorefrontPageIntro } from './StorefrontPrimitives';
import { useStorefrontSession } from './useStorefrontSession';

interface StorefrontCustomerIdentityPageProps {
  provider: StorefrontProvider;
  mode: 'sign-in' | 'register';
}

export function StorefrontCustomerIdentityPage({ provider, mode }: StorefrontCustomerIdentityPageProps) {
  const identity = provider.getCustomerIdentityView();
  const panel = mode === 'sign-in' ? identity.signIn : identity.register;
  const { customer, signIn, signOut } = useStorefrontSession();
  const navigate = useNavigate();
  const initialValues = useMemo(
    () => Object.fromEntries(panel.fields.map((field) => [field.id, ''])),
    [panel.fields],
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = createStorefrontCustomerSession(mode, {
      name: values.name,
      email: values.email ?? '',
      phone: values.phone,
      password: values.password ?? '',
    });

    setErrors(result.errors);
    if (!result.session) return;

    signIn(result.session);
    navigate(identity.returnToCheckoutHref);
  }

  return (
    <main className="bg-[#f7f2ea]" data-storefront-customer-identity data-storefront-customer-identity-mode={mode}>
      <section className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <section>
            <StorefrontPageIntro eyebrow={identity.eyebrow} title={customer ? identity.session.signedInTitle : panel.title} description={customer ? identity.session.signedInDescription : panel.description} />

            {customer ? (
              <section className="mt-5 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm" data-storefront-customer-session-active>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">{identity.session.signedInTitle}</p>
                <p className="mt-2 text-sm font-black text-slate-950" data-storefront-customer-session-name>{customer.name}</p>
                <p className="mt-1 text-[11px] text-slate-600" data-storefront-customer-session-email>{customer.email}</p>
                {customer.phone ? <p className="mt-1 text-[11px] text-slate-600">{customer.phone}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link className="rounded-full bg-[var(--storefront-primary)] px-4 py-2 text-[11px] font-black text-[var(--storefront-on-primary)]" to={identity.returnToCheckoutHref}>
                    {identity.returnToCheckoutLabel}
                  </Link>
                  <button
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[11px] font-black text-slate-700"
                    data-storefront-customer-sign-out
                    onClick={signOut}
                    type="button"
                  >
                    {identity.session.signOutLabel}
                  </button>
                </div>
              </section>
            ) : (
              <form className="mt-5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm" data-storefront-customer-identity-form onSubmit={handleSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {panel.fields.map((field) => (
                    <label key={field.id} className="block">
                      <span className="text-xs font-black text-slate-900">{field.label}</span>
                      <input
                        aria-label={field.label}
                        className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[var(--storefront-primary)]"
                        data-storefront-customer-field={field.id}
                        onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                        placeholder={field.placeholder}
                        type={field.type}
                        value={values[field.id] ?? ''}
                      />
                      <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">{field.helper}</span>
                      {errors[field.id] ? <span className="mt-1 block text-[10px] font-bold text-rose-600" data-storefront-customer-field-error={field.id}>{errors[field.id]}</span> : null}
                    </label>
                  ))}
                </div>

                <button className="mt-5 w-full rounded-full bg-[var(--storefront-primary)] px-4 py-2 text-[11px] font-black text-[var(--storefront-on-primary)]" data-storefront-customer-submit type="submit">
                  {panel.submitLabel}
                </button>

                <div className="mt-4 flex flex-col gap-2 text-xs font-black sm:flex-row sm:items-center sm:justify-between">
                  <Link className="text-orange-700" to={panel.alternateHref}>{panel.alternateLabel}</Link>
                  <Link className="text-slate-700" to={identity.returnToCheckoutHref}>{identity.returnToCheckoutLabel}</Link>
                </div>
              </form>
            )}
          </section>

          <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" data-storefront-customer-identity-notices>
            <p className="text-xs leading-5 text-slate-600">{identity.description}</p>
            <div className="mt-4 space-y-3">
              {identity.notices.map((notice) => (
                <article key={notice.id} className="rounded-xl bg-slate-50 p-3">
                  <h2 className="text-xs font-black text-slate-950">{notice.title}</h2>
                  <p className="mt-1.5 text-[11px] leading-4 text-slate-600">{notice.description}</p>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
