import type { TwoFactorGateway } from '../application/contracts/twoFactor.contracts';
import type { TwoFactorCommandDto, TwoFactorFailureReasonDto, TwoFactorResultDto } from '../application/dtos/twoFactor.dto';

export type MockTwoFactorMode = 'success' | TwoFactorFailureReasonDto;

export class MockTwoFactorGateway implements TwoFactorGateway {
  constructor(private readonly mode: MockTwoFactorMode = 'success', private readonly delayMs = 350) {}

  async verifyCode(command: TwoFactorCommandDto): Promise<TwoFactorResultDto> {
    void command;
    await new Promise<void>((resolve) => setTimeout(resolve, this.delayMs));
    return this.mode === 'success' ? { status: 'success' } : { status: 'failure', reason: this.mode };
  }
}
