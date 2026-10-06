import type {
  SignInBrandingDto,
  SignInFieldDto,
  SignInFeedbackDto,
  SignInHighlightDto,
  SignInPasswordFieldDto,
  SignInValidationCopyDto,
  SignInViewDto,
} from '@/features/authentication/sign-in/application/dtos/signIn.dto';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown, field: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${field}: expected object`);
  }

  return value as JsonRecord;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}: expected non-empty string`);
  }

  return value;
}

function asNullableString(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }

  return asString(value, field);
}

function asPositiveNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${field}: expected positive number`);
  }

  return value;
}

function mapField(value: unknown, field: string): SignInFieldDto {
  const record = asRecord(value, field);

  return {
    label: asString(record.label, `${field}.label`),
    placeholder: asString(record.placeholder, `${field}.placeholder`),
    autocomplete: asString(record.autocomplete, `${field}.autocomplete`),
  };
}

function mapPasswordField(value: unknown): SignInPasswordFieldDto {
  const record = asRecord(value, 'form.password');
  const field = mapField(value, 'form.password');

  return {
    ...field,
    showLabel: asString(record.showLabel, 'form.password.showLabel'),
    hideLabel: asString(record.hideLabel, 'form.password.hideLabel'),
  };
}

function mapBranding(value: unknown): SignInBrandingDto {
  const record = asRecord(value, 'branding');

  return {
    mark: asString(record.mark, 'branding.mark'),
    name: asString(record.name, 'branding.name'),
    logoUrl: asNullableString(record.logoUrl, 'branding.logoUrl'),
    contextLabel: asString(record.contextLabel, 'branding.contextLabel'),
  };
}

function mapHighlights(value: unknown): readonly SignInHighlightDto[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Invalid hero.highlights: expected non-empty array');
  }

  return value.map((item, index) => {
    const record = asRecord(item, `hero.highlights[${index}]`);

    return {
      id: asString(record.id, `hero.highlights[${index}].id`),
      title: asString(record.title, `hero.highlights[${index}].title`),
      description: asString(record.description, `hero.highlights[${index}].description`),
    };
  });
}

function mapValidation(value: unknown): SignInValidationCopyDto {
  const record = asRecord(value, 'form.validation');

  return {
    emailRequired: asString(record.emailRequired, 'form.validation.emailRequired'),
    emailInvalid: asString(record.emailInvalid, 'form.validation.emailInvalid'),
    passwordRequired: asString(record.passwordRequired, 'form.validation.passwordRequired'),
    passwordTooShort: asString(record.passwordTooShort, 'form.validation.passwordTooShort'),
    passwordMinLength: asPositiveNumber(record.passwordMinLength, 'form.validation.passwordMinLength'),
  };
}

function mapFeedback(value: unknown): SignInFeedbackDto {
  const record = asRecord(value, 'form.feedback');

  return {
    successTitle: asString(record.successTitle, 'form.feedback.successTitle'),
    successMessage: asString(record.successMessage, 'form.feedback.successMessage'),
    invalidCredentials: asString(record.invalidCredentials, 'form.feedback.invalidCredentials'),
    unavailable: asString(record.unavailable, 'form.feedback.unavailable'),
  };
}

export function mapSignInViewDto(value: unknown): SignInViewDto {
  const root = asRecord(value, 'sign-in view');
  const hero = asRecord(root.hero, 'hero');
  const form = asRecord(root.form, 'form');
  const forgotPassword = asRecord(form.forgotPassword, 'form.forgotPassword');
  const createAccount = asRecord(form.createAccount, 'form.createAccount');
  const legal = asRecord(root.legal, 'legal');

  return {
    branding: mapBranding(root.branding),
    hero: {
      eyebrow: asString(hero.eyebrow, 'hero.eyebrow'),
      title: asString(hero.title, 'hero.title'),
      description: asString(hero.description, 'hero.description'),
      highlights: mapHighlights(hero.highlights),
    },
    form: {
      eyebrow: asString(form.eyebrow, 'form.eyebrow'),
      title: asString(form.title, 'form.title'),
      description: asString(form.description, 'form.description'),
      email: mapField(form.email, 'form.email'),
      password: mapPasswordField(form.password),
      rememberMeLabel: asString(form.rememberMeLabel, 'form.rememberMeLabel'),
      forgotPassword: {
        label: asString(forgotPassword.label, 'form.forgotPassword.label'),
        href: asString(forgotPassword.href, 'form.forgotPassword.href'),
      },
      submitLabel: asString(form.submitLabel, 'form.submitLabel'),
      submittingLabel: asString(form.submittingLabel, 'form.submittingLabel'),
      createAccount: {
        prompt: asString(createAccount.prompt, 'form.createAccount.prompt'),
        label: asString(createAccount.label, 'form.createAccount.label'),
        href: asString(createAccount.href, 'form.createAccount.href'),
      },
      validation: mapValidation(form.validation),
      feedback: mapFeedback(form.feedback),
    },
    legal: {
      privacyLabel: asString(legal.privacyLabel, 'legal.privacyLabel'),
      privacyHref: asString(legal.privacyHref, 'legal.privacyHref'),
      termsLabel: asString(legal.termsLabel, 'legal.termsLabel'),
      termsHref: asString(legal.termsHref, 'legal.termsHref'),
    },
  };
}
