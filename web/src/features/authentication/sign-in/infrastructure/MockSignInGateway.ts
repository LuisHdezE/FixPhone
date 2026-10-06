import type { SignInGateway } from '@/features/authentication/sign-in/application/contracts/signIn.contracts';
import type {
  SignInCredentialsDto,
  SignInFailureReasonDto,
  SignInResultDto,
} from '@/features/authentication/sign-in/application/dtos/signIn.dto';

export type MockSignInMode = 'success' | SignInFailureReasonDto;

export class MockSignInGateway implements SignInGateway {
  constructor(private readonly mode: MockSignInMode = 'success') {}

  async signIn(credentials: SignInCredentialsDto): Promise<SignInResultDto> {
    void credentials;
    await Promise.resolve();

    if (this.mode === 'success') {
      return { status: 'success' };
    }

    return { status: 'failure', reason: this.mode };
  }
}
