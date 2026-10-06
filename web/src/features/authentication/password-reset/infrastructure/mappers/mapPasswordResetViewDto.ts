import type {
  PasswordResetBrandingDto,
  PasswordResetFieldDto,
  PasswordResetFeedbackDto,
  PasswordResetHighlightDto,
  PasswordResetValidationCopyDto,
  PasswordResetViewDto,
} from '@/features/authentication/password-reset/application/dtos/passwordReset.dto';

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
  return value === null ? null : asString(value, field);
}

function mapBranding(value: unknown): PasswordResetBrandingDto {
  const record = asRecord(value, 'branding');

  return {
    mark: asString(record.mark, 'branding.mark'),
    name: asString(record.name, 'branding.name'),
    logoUrl: asNullableString(record.logoUrl, 'branding.logoUrl'),
    contextLabel: asString(record.contextLabel, 'branding.contextLabel'),
  };
}

function mapHighlights(value: unknown): readonly PasswordResetHighlightDto[] {
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

function mapField(value: unknown, field: string): PasswordResetFieldDto {
  const record = asRecord(value, field);
  return {
    label: asString(record.label, `${field}.label`),
    placeholder: asString(record.placeholder, `${field}.placeholder`),
    autocomplete: asString(record.autocomplete, `${field}.autocomplete`),
  };
}

function mapValidation(value: unknown): PasswordResetValidationCopyDto {
  const record = asRecord(value, 'form.validation');
  return {
    emailRequired: asString(record.emailRequired, 'form.validation.emailRequired'),
    emailInvalid: asString(record.emailInvalid, 'form.validation.emailInvalid'),
  };
}

function mapFeedback(value: unknown): PasswordResetFeedbackDto {
  const record = asRecord(value, 'form.feedback');
  return {
    successTitle: asString(record.successTitle, 'form.feedback.successTitle'),
    successMessage: asString(record.successMessage, 'form.feedback.successMessage'),
    unavailable: asString(record.unavailable, 'form.feedback.unavailable'),
  };
}

export function mapPasswordResetViewDto(value: unknown): PasswordResetViewDto {
  const root = asRecord(value, 'password-reset view');
  const hero = asRecord(root.hero, 'hero');
  const form = asRecord(root.form, 'form');
  const backToSignIn = asRecord(form.backToSignIn, 'form.backToSignIn');
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
      submitLabel: asString(form.submitLabel, 'form.submitLabel'),
      submittingLabel: asString(form.submittingLabel, 'form.submittingLabel'),
      privacyNotice: asString(form.privacyNotice, 'form.privacyNotice'),
      backToSignIn: {
        prompt: asString(backToSignIn.prompt, 'form.backToSignIn.prompt'),
        label: asString(backToSignIn.label, 'form.backToSignIn.label'),
        href: asString(backToSignIn.href, 'form.backToSignIn.href'),
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
