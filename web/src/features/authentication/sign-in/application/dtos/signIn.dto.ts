export interface SignInBrandingDto {
  mark: string;
  name: string;
  logoUrl: string | null;
  contextLabel: string;
}

export interface SignInHighlightDto {
  id: string;
  title: string;
  description: string;
}

export interface SignInFieldDto {
  label: string;
  placeholder: string;
  autocomplete: string;
}

export interface SignInPasswordFieldDto extends SignInFieldDto {
  showLabel: string;
  hideLabel: string;
}

export interface SignInValidationCopyDto {
  emailRequired: string;
  emailInvalid: string;
  passwordRequired: string;
  passwordTooShort: string;
  passwordMinLength: number;
}

export interface SignInFeedbackDto {
  successTitle: string;
  successMessage: string;
  invalidCredentials: string;
  unavailable: string;
}

export interface SignInViewDto {
  branding: SignInBrandingDto;
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    highlights: readonly SignInHighlightDto[];
  };
  form: {
    eyebrow: string;
    title: string;
    description: string;
    email: SignInFieldDto;
    password: SignInPasswordFieldDto;
    rememberMeLabel: string;
    forgotPassword: {
      label: string;
      href: string;
    };
    submitLabel: string;
    submittingLabel: string;
    createAccount: {
      prompt: string;
      label: string;
      href: string;
    };
    validation: SignInValidationCopyDto;
    feedback: SignInFeedbackDto;
  };
  legal: {
    privacyLabel: string;
    privacyHref: string;
    termsLabel: string;
    termsHref: string;
  };
}

export interface SignInCredentialsDto {
  email: string;
  password: string;
  rememberMe: boolean;
}

export type SignInValidationErrorCode =
  | 'email-required'
  | 'email-invalid'
  | 'password-required'
  | 'password-too-short';

export interface SignInValidationErrorsDto {
  email?: SignInValidationErrorCode;
  password?: SignInValidationErrorCode;
}

export interface SignInValidationPolicyDto {
  passwordMinLength: number;
}

export type SignInFailureReasonDto = 'invalid-credentials' | 'unavailable';

export type SignInResultDto =
  | { status: 'success' }
  | { status: 'failure'; reason: SignInFailureReasonDto };
