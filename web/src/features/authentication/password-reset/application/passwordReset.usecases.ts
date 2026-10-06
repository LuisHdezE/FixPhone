import type {
  PasswordResetRequestDto,
  PasswordResetResultDto,
  PasswordResetValidationErrorsDto,
  PasswordResetViewDto,
} from '@/features/authentication/password-reset/application/dtos/passwordReset.dto';
import type {
  PasswordResetContentProvider,
  PasswordResetGateway,
} from '@/features/authentication/password-reset/application/contracts/passwordReset.contracts';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function loadPasswordResetView(provider: PasswordResetContentProvider): PasswordResetViewDto {
  return provider.getView();
}

export function validatePasswordResetRequest(
  request: PasswordResetRequestDto,
): PasswordResetValidationErrorsDto {
  const email = request.email.trim();

  if (!email) {
    return { email: 'email-required' };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { email: 'email-invalid' };
  }

  return {};
}

export function hasPasswordResetValidationErrors(
  errors: PasswordResetValidationErrorsDto,
): boolean {
  return Boolean(errors.email);
}

export async function submitPasswordReset(
  gateway: PasswordResetGateway,
  request: PasswordResetRequestDto,
): Promise<PasswordResetResultDto> {
  return gateway.requestReset({
    email: request.email.trim().toLowerCase(),
  });
}
