import type { TwoFactorContentProvider, TwoFactorGateway } from './contracts/twoFactor.contracts';
import type { TwoFactorRequestDto, TwoFactorSubmissionDto, TwoFactorValidationErrorCode } from './dtos/twoFactor.dto';

export function loadTwoFactorView(provider: TwoFactorContentProvider) { return provider.getView(); }

export function validateTwoFactorRequest(request: TwoFactorRequestDto, codeLength: number): TwoFactorValidationErrorCode | undefined {
  const code = request.code.trim();
  if (!code) return 'code-required';
  if (!Number.isInteger(codeLength) || codeLength < 4 || codeLength > 8 || code.length !== codeLength || !/^[0-9]+$/.test(code)) return 'code-invalid';
  return undefined;
}

export async function submitTwoFactor(gateway: TwoFactorGateway, request: TwoFactorRequestDto, codeLength: number): Promise<TwoFactorSubmissionDto> {
  const error = validateTwoFactorRequest(request, codeLength);
  if (error) return { status: 'invalid', error };
  try {
    return await gateway.verifyCode({ code: request.code.trim() });
  } catch {
    return { status: 'failure', reason: 'unavailable' };
  }
}
