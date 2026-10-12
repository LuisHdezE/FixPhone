import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
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
  rememberMe: true,
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
    <div className="flex items-center gap-2.5">
      {branding.logoUrl ? (
        <img className="size-9 rounded-xl object-contain" src={branding.logoUrl} alt={branding.name} />
      ) : (
        <div className="grid size-9 place-items-center rounded-xl bg-[var(--theme-primary)] text-sm font-bold tracking-wide text-[var(--theme-on-primary)] shadow-sm">
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
  const navigate = useNavigate();
  const location = useLocation();
  const requestedPage = (location.state as { from?: string } | null)?.from;
  const safeInternalPath = typeof requestedPage === 'string' &&
    ['/admin/', '/apps/', '/applications/', '/user/'].some((prefix) => requestedPage.startsWith(prefix));
  const landingPage = safeInternalPath ? requestedPage : '/apps/inventory/dashboard';
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
        navigate(landingPage, { replace: true });
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
    <main className="flex min-h-dvh items-center justify-center bg-[var(--surface-page)] px-2 py-2 sm:px-4 sm:py-4" aria-labelledby="sign-in-title">
      <div className="mx-auto grid w-full max-w-[1020px] gap-2 overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_18px_56px_rgba(15,23,42,0.09)] lg:min-h-[500px] lg:grid-cols-[1.04fr_0.96fr] lg:p-2">
        <section className="relative hidden min-h-[480px] overflow-hidden rounded-[18px] bg-slate-900 lg:block" aria-label="Servicio técnico y venta de celulares FixPhone">
          <img
            src="/assets/login-fixphone.jpg"
            alt="Técnico de FixPhone asesorando a una clienta mientras se repara un celular en el taller"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/15 to-transparent" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white xl:p-8">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-red-300">FixPhone · Montevideo</p>
            <h1 className="max-w-sm text-[1.85rem] font-bold leading-[1.12] tracking-tight xl:text-[2.1rem]">Tecnología que vuelve a funcionar.</h1>
            <p className="mt-2 max-w-sm text-[13px] leading-5 text-white/85">Reparaciones, equipos seleccionados y atención de confianza, todo en un mismo lugar.</p>
          </div>
        </section>
        <section className="flex items-center px-4 py-4 sm:px-8 sm:py-7 lg:px-7 xl:px-10">
          <div className="mx-auto w-full max-w-[375px]">
            <div className="mb-4 sm:mb-5">
              <BrandIdentity branding={view.branding} />
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-primary)]">{view.form.eyebrow}</p>
            <h2 id="sign-in-title" className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              {view.form.title}
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-slate-600">{view.form.description}</p>

            <form className="mt-3 space-y-3 sm:mt-4" noValidate onSubmit={handleSubmit}>
              <div>
                <label className="text-[13px] font-medium text-slate-800" htmlFor="sign-in-email">
                  {view.form.email.label}
                </label>
                <input
                  id="sign-in-email"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary-soft)]"
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
                <label className="text-[13px] font-medium text-slate-800" htmlFor="sign-in-password">
                  {view.form.password.label}
                </label>
                <div className="relative mt-1">
                  <input
                    id="sign-in-password"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-12 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary-soft)]"
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
                  <div className="absolute inset-y-0 right-2 flex items-center">
                    <button
                      className="grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
                      type="button"
                      aria-controls="sign-in-password"
                      aria-label={showPassword ? view.form.password.hideLabel : view.form.password.showLabel}
                      title={showPassword ? view.form.password.hideLabel : view.form.password.showLabel}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                        {showPassword ? <path d="M3 3l18 18" /> : null}
                      </svg>
                    </button>
                  </div>
                </div>
                {passwordError ? (
                  <p id="sign-in-password-error" className="mt-1.5 text-xs font-medium text-[var(--semantic-danger)]" role="alert">
                    {passwordError}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
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
              <p className="-mt-1 text-[11px] leading-4 text-slate-500">
                {credentials.rememberMe
                  ? 'Tu sesión estará disponible en otras pestañas de este navegador durante 12 horas, salvo que cierres sesión.'
                  : 'Sin esta opción, la sesión se conserva solo en esta pestaña.'}
              </p>

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
                className="w-full rounded-xl bg-[var(--theme-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--theme-on-primary)] shadow-sm transition hover:bg-[var(--theme-primary-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-primary-soft)] disabled:cursor-not-allowed disabled:opacity-65"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? view.form.submittingLabel : view.form.submitLabel}
              </button>
            </form>
            <p className="mt-3 border-t border-slate-100 pt-2 text-center text-[11px] text-slate-500">
              El alta de usuarios administrativos se gestiona desde FixPhone.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
