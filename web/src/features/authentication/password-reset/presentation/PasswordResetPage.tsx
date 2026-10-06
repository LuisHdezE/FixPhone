import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import type {
  PasswordResetContentProvider,
  PasswordResetGateway,
} from '@/features/authentication/password-reset/application/contracts/passwordReset.contracts';
import type {
  PasswordResetFailureReasonDto,
  PasswordResetRequestDto,
  PasswordResetValidationErrorCode,
  PasswordResetViewDto,
} from '@/features/authentication/password-reset/application/dtos/passwordReset.dto';
import {
  hasPasswordResetValidationErrors,
  loadPasswordResetView,
  submitPasswordReset,
  validatePasswordResetRequest,
} from '@/features/authentication/password-reset/application/passwordReset.usecases';

interface PasswordResetPageProps {
  contentProvider: PasswordResetContentProvider;
  gateway: PasswordResetGateway;
}

type SubmissionState = 'idle' | 'submitting' | 'success' | 'failure';

function validationMessage(
  code: PasswordResetValidationErrorCode | undefined,
  view: PasswordResetViewDto,
): string | undefined {
  if (code === 'email-required') return view.form.validation.emailRequired;
  if (code === 'email-invalid') return view.form.validation.emailInvalid;
  return undefined;
}

function failureMessage(
  reason: PasswordResetFailureReasonDto | null,
  view: PasswordResetViewDto,
): string | null {
  return reason === 'unavailable' ? view.form.feedback.unavailable : null;
}

function BrandIdentity({ branding }: { branding: PasswordResetViewDto['branding'] }) {
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

export function PasswordResetPage({ contentProvider, gateway }: PasswordResetPageProps) {
  const view = loadPasswordResetView(contentProvider);
  const [request, setRequest] = useState<PasswordResetRequestDto>({ email: '' });
  const [emailErrorCode, setEmailErrorCode] = useState<PasswordResetValidationErrorCode | undefined>();
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [failureReason, setFailureReason] = useState<PasswordResetFailureReasonDto | null>(null);

  const emailError = validationMessage(emailErrorCode, view);
  const submitFailureMessage = failureMessage(failureReason, view);
  const isSubmitting = submissionState === 'submitting';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors = validatePasswordResetRequest(request);
    setEmailErrorCode(errors.email);
    setFailureReason(null);

    if (hasPasswordResetValidationErrors(errors)) {
      setSubmissionState('idle');
      return;
    }

    setSubmissionState('submitting');

    try {
      const result = await submitPasswordReset(gateway, request);
      if (result.status === 'success') {
        setSubmissionState('success');
        return;
      }

      setFailureReason(result.reason);
      setSubmissionState('failure');
    } catch {
      setFailureReason('unavailable');
      setSubmissionState('failure');
    }
  }

  return (
    <main className="min-h-dvh bg-[var(--surface-page)] px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-4" aria-labelledby="password-reset-title">
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
            <h2 id="password-reset-title" className="mt-2 text-[1.75rem] font-semibold tracking-[-0.03em] text-slate-950">
              {view.form.title}
            </h2>
            <p className="mt-2 text-sm leading-5 text-slate-600">{view.form.description}</p>

            <form className="mt-5 space-y-4" noValidate onSubmit={handleSubmit}>
              <div>
                <label className="text-sm font-medium text-slate-800" htmlFor="password-reset-email">
                  {view.form.email.label}
                </label>
                <input
                  id="password-reset-email"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary-soft)]"
                  type="email"
                  autoComplete={view.form.email.autocomplete}
                  placeholder={view.form.email.placeholder}
                  value={request.email}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'password-reset-email-error' : 'password-reset-privacy-notice'}
                  onChange={(event) => {
                    setRequest({ email: event.target.value });
                    setEmailErrorCode(undefined);
                    setFailureReason(null);
                    setSubmissionState('idle');
                  }}
                />
                {emailError ? (
                  <p id="password-reset-email-error" className="mt-1.5 text-xs font-medium text-[var(--semantic-danger)]" role="alert">
                    {emailError}
                  </p>
                ) : null}
              </div>

              <p id="password-reset-privacy-notice" className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-4 text-slate-600">
                {view.form.privacyNotice}
              </p>

              {submissionState === 'success' ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5" role="status" aria-live="polite">
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
                disabled={isSubmitting}
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

            <div className="mt-4 flex items-center justify-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <Link className="hover:text-slate-800" to={view.legal.privacyHref}>{view.legal.privacyLabel}</Link>
              <span aria-hidden="true">•</span>
              <Link className="hover:text-slate-800" to={view.legal.termsHref}>{view.legal.termsLabel}</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
