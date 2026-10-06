import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import type {
  TwoFactorContentProvider,
  TwoFactorGateway,
} from '@/features/authentication/two-factor/application/contracts/twoFactor.contracts';
import type {
  TwoFactorFailureReasonDto,
  TwoFactorRequestDto,
  TwoFactorValidationErrorCode,
  TwoFactorViewDto,
} from '@/features/authentication/two-factor/application/dtos/twoFactor.dto';
import {
  loadTwoFactorView,
  submitTwoFactor,
} from '@/features/authentication/two-factor/application/twoFactor.usecases';

interface TwoFactorPageProps {
  contentProvider: TwoFactorContentProvider;
  gateway: TwoFactorGateway;
}

type SubmissionState = 'idle' | 'submitting' | 'success' | 'failure';

function validationMessage(
  code: TwoFactorValidationErrorCode | undefined,
  view: TwoFactorViewDto,
): string | undefined {
  if (code === 'code-required') return view.form.validation.codeRequired;
  if (code === 'code-invalid') return view.form.validation.codeInvalid;
  return undefined;
}

function failureMessage(
  reason: TwoFactorFailureReasonDto | null,
  view: TwoFactorViewDto,
): string | null {
  if (reason === 'invalid-code') return view.form.feedback.invalidCode;
  if (reason === 'expired-code') return view.form.feedback.expiredCode;
  return reason === 'unavailable' ? view.form.feedback.unavailable : null;
}

function BrandIdentity({ branding }: { branding: TwoFactorViewDto['branding'] }) {
  return (
    <div className="flex items-center gap-3">
      {branding.logoUrl ? (
        <img className="size-11 rounded-xl object-contain" src={branding.logoUrl} alt={branding.name} />
      ) : (
        <div className="grid size-11 place-items-center rounded-xl bg-[var(--theme-primary)] text-sm font-bold tracking-wide text-[var(--theme-on-primary)] shadow-sm">
          {branding.mark}
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-slate-900">{branding.name}</p>
        <p className="text-xs text-slate-500">{branding.contextLabel}</p>
      </div>
    </div>
  );
}

export function TwoFactorPage({ contentProvider, gateway }: TwoFactorPageProps) {
  const view = loadTwoFactorView(contentProvider);
  const [request, setRequest] = useState<TwoFactorRequestDto>({ code: '' });
  const [codeErrorCode, setCodeErrorCode] = useState<TwoFactorValidationErrorCode | undefined>();
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [failureReason, setFailureReason] = useState<TwoFactorFailureReasonDto | null>(null);

  const codeError = validationMessage(codeErrorCode, view);
  const submitFailureMessage = failureMessage(failureReason, view);
  const isSubmitting = submissionState === 'submitting';

  const pending = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || submissionState === 'success') return;
    pending.current = true;
    setCodeErrorCode(undefined);
    setFailureReason(null);
    setSubmissionState('submitting');
    try {
      const result = await submitTwoFactor(gateway, request, view.form.codeLength);
      if (result.status === 'invalid') {
        setCodeErrorCode(result.error);
        setSubmissionState('idle');
        inputRef.current?.focus();
      } else if (result.status === 'success') {
        setRequest({ code: '' });
        setSubmissionState('success');
        requestAnimationFrame(() => statusRef.current?.focus());
      } else {
        setFailureReason(result.reason);
        setSubmissionState('failure');
        inputRef.current?.focus();
      }
    } finally {
      pending.current = false;
    }
  }

  return (
    <main className="min-h-dvh bg-[var(--surface-page)] px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-4" aria-labelledby="two-factor-title">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-[1180px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:min-h-[calc(100dvh-2rem)] lg:min-h-[calc(100dvh-2rem)] lg:grid-cols-[1.04fr_0.96fr]">
        <section className="relative hidden overflow-hidden bg-[var(--theme-primary-soft)] px-8 py-6 lg:block lg:border-r lg:border-[var(--theme-primary-muted)] xl:px-10 xl:py-7">
          <div className="pointer-events-none absolute -right-24 -top-20 size-72 rounded-full border border-[var(--theme-primary-border)]/60 bg-white/35" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-24 -left-20 size-64 rounded-full border border-[var(--theme-primary-border)]/45 bg-white/25" aria-hidden="true" />

          <div className="relative flex h-full flex-col">
            <BrandIdentity branding={view.branding} />

            <div className="relative mt-9 max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-primary)]">{view.hero.eyebrow}</p>
              <h1 className="mt-2 max-w-lg text-[2.45rem] font-semibold leading-[1.05] tracking-[-0.035em] text-slate-950">
                {view.hero.title}
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-5 text-slate-600">{view.hero.description}</p>

              <div className="mt-5 grid gap-2 lg:grid-cols-1 xl:grid-cols-3">
                {view.hero.highlights.map((highlight) => (
                  <article key={highlight.id} className="rounded-2xl border border-white/80 bg-white/65 p-3.5 shadow-sm backdrop-blur-sm">
                    <div className="mb-2 size-2 rounded-full bg-[var(--theme-primary)]" aria-hidden="true" />
                    <h2 className="text-[13px] font-semibold text-slate-900">{highlight.title}</h2>
                    <p className="mt-1 text-[11px] leading-4 text-slate-600">{highlight.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center px-6 py-6 sm:px-8 sm:py-7 lg:px-10 lg:py-5 xl:px-12">
          <div className="mx-auto w-full max-w-[430px]">
            <div className="mb-6 lg:hidden">
              <BrandIdentity branding={view.branding} />
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-primary)]">{view.form.eyebrow}</p>
            <h2 id="two-factor-title" className="mt-2 text-[1.75rem] font-semibold tracking-[-0.03em] text-slate-950">
              {view.form.title}
            </h2>
            <p className="mt-2 text-sm leading-5 text-slate-600">{view.form.description}</p>

            <form className="mt-5 space-y-4" noValidate onSubmit={handleSubmit} aria-busy={isSubmitting}>
              <div>
                <label className="text-sm font-medium text-slate-800" htmlFor="two-factor-code">
                  {view.form.code.label}
                </label>
                <input
                  id="two-factor-code"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary-soft)]"
                  type="text"
                  inputMode="numeric"
                  ref={inputRef}
                  readOnly={isSubmitting || submissionState === 'success'}
                  autoComplete={view.form.code.autocomplete}
                  placeholder={view.form.code.placeholder}
                  value={request.code}
                  aria-invalid={Boolean(codeError)}
                  aria-describedby={codeError ? 'two-factor-code-hint two-factor-code-error' : 'two-factor-code-hint'}
                  onChange={(event) => {
                    if (pending.current || submissionState === 'success') return;
                    setRequest({ code: event.target.value });
                    setCodeErrorCode(undefined);
                    setFailureReason(null);
                    setSubmissionState('idle');
                  }}
                />
                <p id="two-factor-code-hint" className="mt-1.5 text-xs text-slate-500">{view.form.codeHint}</p>
                {codeError ? (
                  <p id="two-factor-code-error" className="mt-1.5 text-xs font-medium text-[var(--semantic-danger)]" role="alert">
                    {codeError}
                  </p>
                ) : null}
              </div>

              <p id="two-factor-demo-notice" className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-4 text-slate-600">
                {view.form.demoNotice}
              </p>

              {submissionState === 'success' ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5" role="status" aria-live="polite" tabIndex={-1} ref={statusRef}>
                  <p className="text-sm font-semibold text-emerald-800">{view.form.feedback.successTitle}</p>
                  <p className="mt-1 text-xs leading-4 text-emerald-700">{view.form.feedback.successMessage}</p>
                </div>
              ) : null}

              {submissionState === 'failure' && submitFailureMessage ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">
                  {submitFailureMessage}
                </div>
              ) : null}

              <button
                className="w-full rounded-xl bg-[var(--theme-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--theme-on-primary)] shadow-sm transition hover:bg-[var(--theme-primary-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-primary-soft)] disabled:cursor-not-allowed disabled:opacity-65"
                type="submit"
                disabled={isSubmitting || submissionState === 'success'}
              >
                {isSubmitting ? view.form.submittingLabel : view.form.submitLabel}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-slate-600">
              {view.form.backToSignIn.prompt}{' '}
              <Link className="font-semibold text-[var(--theme-primary)] hover:text-[var(--theme-primary-hover)]" to={view.form.backToSignIn.href}>
                {view.form.backToSignIn.label}
              </Link>
            </p>

          </div>
        </section>
      </div>
    </main>
  );
}
