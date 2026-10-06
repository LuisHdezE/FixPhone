import type { PasswordResetGateway } from '@/features/authentication/password-reset/application/contracts/passwordReset.contracts';
import type {
  PasswordResetRequestDto,
  PasswordResetResultDto,
} from '@/features/authentication/password-reset/application/dtos/passwordReset.dto';

export type MockPasswordResetMode = 'success' | 'unavailable';

export class MockPasswordResetGateway implements PasswordResetGateway {
  constructor(private readonly mode: MockPasswordResetMode = 'success') {}

  async requestReset(request: PasswordResetRequestDto): Promise<PasswordResetResultDto> {
    void request;

    if (this.mode === 'unavailable') {
      return { status: 'failure', reason: 'unavailable' };
    }

    return { status: 'success' };
  }
}
