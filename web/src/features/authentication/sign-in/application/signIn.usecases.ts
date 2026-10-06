import type {
  SignInCredentialsDto,
  SignInResultDto,
  SignInValidationErrorsDto,
  SignInValidationPolicyDto,
  SignInViewDto,
} from '@/features/authentication/sign-in/application/dtos/signIn.dto';
import type {
  SignInContentProvider,
  SignInGateway,
} from '@/features/authentication/sign-in/application/contracts/signIn.contracts';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function loadSignInView(provider: SignInContentProvider): SignInViewDto {
  return provider.getView();
}

export function validateSignInCredentials(
  credentials: SignInCredentialsDto,
  policy: SignInValidationPolicyDto,
): SignInValidationErrorsDto {
  const errors: SignInValidationErrorsDto = {};
  const email = credentials.email.trim();

  if (!email) {
    errors.email = 'email-required';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'email-invalid';
  }

  if (!credentials.password) {
    errors.password = 'password-required';
  } else if (credentials.password.length < policy.passwordMinLength) {
    errors.password = 'password-too-short';
  }

  return errors;
}

export function hasSignInValidationErrors(errors: SignInValidationErrorsDto): boolean {
  return Boolean(errors.email || errors.password);
}

export async function submitSignIn(
  gateway: SignInGateway,
  credentials: SignInCredentialsDto,
): Promise<SignInResultDto> {
  return gateway.signIn({
    email: credentials.email.trim().toLowerCase(),
    password: credentials.password,
    rememberMe: credentials.rememberMe,
  });
}
