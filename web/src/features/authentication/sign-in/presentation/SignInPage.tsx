import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import type { SignInContentProvider, SignInGateway } from '@/features/authentication/sign-in/application/contracts/signIn.contracts';
import type {
  SignInCredentialsDto,
  SignInFailureReasonDto,
  SignInValidationErrorCode,
  SignInValidationErrorsDto,
  SignInViewDto,
} from '@/features/authentication/sign-in/application/dtos/signIn.dto';
import {
  hasSignInValidationErrors,
  loadSignInView,
  submitSignIn,
  validateSignInCredentials,
} from '@/features/authentication/sign-in/application/signIn.usecases';

interface SignInPageProps {
  contentProvider: SignInContentProvider;
  gateway: SignInGateway;
}

type SubmissionState = 'idle' | 'submitting' | 'success' | 'failure';

const initialCredentials: SignInCredentialsDto = {
  email: '',
  password: '',
  rememberMe: false,
};

function validationMessage(
  code: SignInValidationErrorCode | undefined,
  view: SignInViewDto,
): string | undefined {
  switch (code) {
    case 'email-required':
      return view.form.validation.emailRequired;
    case 'email-invalid':
      return view.form.validation.emailInvalid;
    case 'password-required':
      return view.form.validation.passwordRequired;
    case 'password-too-short':
      return view.form.validation.passwordTooShort;
    default:
      return undefined;
  }
}

function failureMessage(reason: SignInFailureReasonDto | null, view: SignInViewDto): string | null {
  if (reason === 'invalid-credentials') {
    return view.form.feedback.invalidCredentials;
  }

  if (reason === 'unavailable') {
    return view.form.feedback.unavailable;
  }

  return null;
}

function clearValidationError(
  current: SignInValidationErrorsDto,
  field: keyof SignInValidationErrorsDto,
): SignInValidationErrorsDto {
  const next = { ...current };
  delete next[field];
  return next;
}

function BrandIdentity({ branding }: { branding: SignInViewDto['branding'] }) {
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

export function SignInPage({ contentProvider, gateway }: SignInPageProps) {
  const view = loadSignInView(contentProvider);
  const [credentials, setCredentials] = useState<SignInCredentialsDto>(initialCredentials);
  const [errors, setErrors] = useState<SignInValidationErrorsDto>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [failureReason, setFailureReason] = useState<SignInFailureReasonDto | null>(null);

  const emailError = validationMessage(errors.email, view);
  const passwordError = validationMessage(errors.password, view);
  const submitFailureMessage = failureMessage(failureReason, view);
  const isSubmitting = submissionState === 'submitting';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateSignInCredentials(credentials, {
      passwordMinLength: view.form.validation.passwordMinLength,
    });

    setErrors(nextErrors);
    setFailureReason(null);

    if (hasSignInValidationErrors(nextErrors)) {
      setSubmissionState('idle');
      return;
    }

    setSubmissionState('submitting');

    try {
      const result = await submitSignIn(gateway, credentials);

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
    <main className="min-h-dvh bg-[var(--surface-page)] px-3 py-3 sm:px-5 sm:py-5 lg:px-7 lg:py-7" aria-labelledby="sign-in-title">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-[1180px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:min-h-[calc(100dvh-2.5rem)] lg:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[1.04fr_0.96fr]">
        <section className="relative hidden overflow-hidden bg-[var(--theme-primary-soft)] px-10 py-12 lg:block lg:border-r lg:border-[var(--theme-primary-muted)]">
          <div className="pointer-events-none absolute -right-24 -top-20 size-72 rounded-full border border-[var(--theme-primary-border)]/60 bg-white/35" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-24 -left-20 size-64 rounded-full border border-[var(--theme-primary-border)]/45 bg-white/25" aria-hidden="true" />

          <div className="relative flex h-full flex-col">
            <BrandIdentity branding={view.branding} />

            <div className="relative my-auto max-w-xl py-16">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-primary)]">{view.hero.eyebrow}</p>
              <h1 className="mt-3 max-w-lg text-[2.8rem] font-semibold leading-[1.08] tracking-[-0.035em] text-slate-950">
                {view.hero.title}
              </h1>
              <p className="mt-4 max-w-lg text-[15px] leading-6 text-slate-600">{view.hero.description}</p>

              <div className="mt-8 grid gap-3 lg:grid-cols-1 xl:grid-cols-3">
                {view.hero.highlights.map((highlight) => (
                  <article key={highlight.id} className="rounded-2xl border border-white/80 bg-white/65 p-4 shadow-sm backdrop-blur-sm">
                    <div className="mb-3 size-2 rounded-full bg-[var(--theme-primary)]" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-slate-900">{highlight.title}</h2>
                    <p className="mt-1.5 text-xs leading-5 text-slate-600">{highlight.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-[430px]">
            <div className="mb-8 lg:hidden">
              <BrandIdentity branding={view.branding} />
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-primary)]">{view.form.eyebrow}</p>
            <h2 id="sign-in-title" className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
              {view.form.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{view.form.description}</p>

            <form className="mt-7 space-y-5" noValidate onSubmit={handleSubmit}>
              <div>
                <label className="text-sm font-medium text-slate-800" htmlFor="sign-in-email">
                  {view.form.email.label}
                </label>
                <input
                  id="sign-in-email"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary-soft)]"
                  type="email"
                  autoComplete={view.form.email.autocomplete}
                  placeholder={view.form.email.placeholder}
                  value={credentials.email}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'sign-in-email-error' : undefined}
                  onChange={(event) => {
                    setCredentials((current) => ({ ...current, email: event.target.value }));
                    setErrors((current) => clearValidationError(current, 'email'));
                    setSubmissionState('idle');
                  }}
                />
                {emailError ? (
                  <p id="sign-in-email-error" className="mt-1.5 text-xs font-medium text-[var(--semantic-danger)]" role="alert">
                    {emailError}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-800" htmlFor="sign-in-password">
                  {view.form.password.label}
                </label>
                <div className="relative mt-2">
                  <input
                    id="sign-in-password"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 pr-3.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary-soft)] sm:pr-36"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={view.form.password.autocomplete}
                    placeholder={view.form.password.placeholder}
                    value={credentials.password}
                    aria-invalid={Boolean(passwordError)}
                    aria-describedby={passwordError ? 'sign-in-password-error' : undefined}
                    onChange={(event) => {
                      setCredentials((current) => ({ ...current, password: event.target.value }));
                      setErrors((current) => clearValidationError(current, 'password'));
                      setSubmissionState('idle');
                    }}
                  />
                  <div className="mt-2 flex justify-end sm:absolute sm:inset-y-0 sm:right-2.5 sm:mt-0 sm:items-center">
                    <button
                      className="min-h-10 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--theme-primary)] transition hover:bg-[var(--theme-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] sm:min-h-0 sm:py-1.5"
                      type="button"
                      aria-controls="sign-in-password"
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? view.form.password.hideLabel : view.form.password.showLabel}
                    </button>
                  </div>
                </div>
                {passwordError ? (
                  <p id="sign-in-password-error" className="mt-1.5 text-xs font-medium text-[var(--semantic-danger)]" role="alert">
                    {passwordError}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-slate-600">
                  <input
                    className="size-4 rounded border-slate-300 accent-[var(--theme-primary)]"
                    type="checkbox"
                    checked={credentials.rememberMe}
                    onChange={(event) => setCredentials((current) => ({ ...current, rememberMe: event.target.checked }))}
                  />
                  <span>{view.form.rememberMeLabel}</span>
                </label>
                <Link className="font-semibold text-[var(--theme-primary)] hover:text-[var(--theme-primary-hover)]" to={view.form.forgotPassword.href}>
                  {view.form.forgotPassword.label}
                </Link>
              </div>

              {submissionState === 'success' ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3" role="status" aria-live="polite">
                  <p className="text-sm font-semibold text-emerald-800">{view.form.feedback.successTitle}</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-700">{view.form.feedback.successMessage}</p>
                </div>
              ) : null}

              {submissionState === 'failure' && submitFailureMessage ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {submitFailureMessage}
                </div>
              ) : null}

              <button
                className="w-full rounded-xl bg-[var(--theme-primary)] px-4 py-3 text-sm font-semibold text-[var(--theme-on-primary)] shadow-sm transition hover:bg-[var(--theme-primary-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-primary-soft)] disabled:cursor-not-allowed disabled:opacity-65"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? view.form.submittingLabel : view.form.submitLabel}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              {view.form.createAccount.prompt}{' '}
              <Link className="font-semibold text-[var(--theme-primary)] hover:text-[var(--theme-primary-hover)]" to={view.form.createAccount.href}>
                {view.form.createAccount.label}
              </Link>
            </p>

            <div className="mt-8 flex items-center justify-center gap-4 border-t border-slate-100 pt-5 text-xs text-slate-500">
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
