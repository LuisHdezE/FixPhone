import type {
  SignInCredentialsDto,
  SignInResultDto,
  SignInViewDto,
} from '@/features/authentication/sign-in/application/dtos/signIn.dto';

export interface SignInContentProvider {
  getView(): SignInViewDto;
}

export interface SignInGateway {
  signIn(credentials: SignInCredentialsDto): Promise<SignInResultDto>;
}
