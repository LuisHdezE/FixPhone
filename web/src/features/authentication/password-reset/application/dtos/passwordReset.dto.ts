export interface PasswordResetBrandingDto {
  mark: string;
  name: string;
  logoUrl: string | null;
  contextLabel: string;
}

export interface PasswordResetHighlightDto {
  id: string;
  title: string;
  description: string;
}

export interface PasswordResetFieldDto {
  label: string;
  placeholder: string;
  autocomplete: string;
}

export interface PasswordResetValidationCopyDto {
  emailRequired: string;
  emailInvalid: string;
}

export interface PasswordResetFeedbackDto {
  successTitle: string;
  successMessage: string;
  unavailable: string;
}

export interface PasswordResetViewDto {
  branding: PasswordResetBrandingDto;
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    highlights: readonly PasswordResetHighlightDto[];
  };
  form: {
    eyebrow: string;
    title: string;
    description: string;
    email: PasswordResetFieldDto;
    submitLabel: string;
    submittingLabel: string;
    privacyNotice: string;
    backToSignIn: {
      prompt: string;
      label: string;
      href: string;
    };
    validation: PasswordResetValidationCopyDto;
    feedback: PasswordResetFeedbackDto;
  };
  legal: {
    privacyLabel: string;
    privacyHref: string;
    termsLabel: string;
    termsHref: string;
  };
}

export interface PasswordResetRequestDto {
  email: string;
}

export type PasswordResetValidationErrorCode = 'email-required' | 'email-invalid';

export interface PasswordResetValidationErrorsDto {
  email?: PasswordResetValidationErrorCode;
}

export type PasswordResetFailureReasonDto = 'unavailable';

export type PasswordResetResultDto =
  | { status: 'success' }
  | { status: 'failure'; reason: PasswordResetFailureReasonDto };
