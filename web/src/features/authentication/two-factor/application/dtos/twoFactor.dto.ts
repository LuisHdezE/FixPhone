export interface TwoFactorBrandingDto {
  mark: string;
  name: string;
  logoUrl: string | null;
  contextLabel: string;
}

export interface TwoFactorHighlightDto {
  id: string;
  title: string;
  description: string;
}

export interface TwoFactorFieldDto {
  label: string;
  placeholder: string;
  autocomplete: string;
}

export interface TwoFactorValidationCopyDto {
  codeRequired: string;
  codeInvalid: string;
}

export interface TwoFactorFeedbackDto {
  successTitle: string;
  successMessage: string;
  unavailable: string;
  invalidCode: string;
  expiredCode: string;
}

export interface TwoFactorViewDto {
  branding: TwoFactorBrandingDto;
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    highlights: readonly TwoFactorHighlightDto[];
  };
  form: {
    eyebrow: string;
    title: string;
    description: string;
    code: TwoFactorFieldDto;
    submitLabel: string;
    submittingLabel: string;
    demoNotice: string;
    codeHint: string;
    codeLength: number;
    backToSignIn: {
      prompt: string;
      label: string;
      href: string;
    };
    validation: TwoFactorValidationCopyDto;
    feedback: TwoFactorFeedbackDto;
  };
  legal: {
    privacyLabel: string;
    privacyHref: string;
    termsLabel: string;
    termsHref: string;
  };
}

export interface TwoFactorRequestDto { code: string; }
export interface TwoFactorCommandDto { code: string; }
export type TwoFactorValidationErrorCode = 'code-required' | 'code-invalid';
export type TwoFactorFailureReasonDto = 'invalid-code' | 'expired-code' | 'unavailable';
export type TwoFactorResultDto =
  | { status: 'success' }
  | { status: 'failure'; reason: TwoFactorFailureReasonDto };
export type TwoFactorSubmissionDto = TwoFactorResultDto | { status: 'invalid'; error: TwoFactorValidationErrorCode };
