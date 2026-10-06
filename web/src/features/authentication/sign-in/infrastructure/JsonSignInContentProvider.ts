import rawView from '@/features/authentication/sign-in/infrastructure/sign-in.view.json';
import type { SignInContentProvider } from '@/features/authentication/sign-in/application/contracts/signIn.contracts';
import type { SignInViewDto } from '@/features/authentication/sign-in/application/dtos/signIn.dto';
import { mapSignInViewDto } from '@/features/authentication/sign-in/infrastructure/mappers/mapSignInViewDto';

export class JsonSignInContentProvider implements SignInContentProvider {
  private readonly view: SignInViewDto;

  constructor() {
    this.view = mapSignInViewDto(rawView);
  }

  getView(): SignInViewDto {
    return this.view;
  }
}
