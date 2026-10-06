import rawView from '@/features/authentication/two-factor/infrastructure/two-factor.view.json';
import type { TwoFactorContentProvider } from '@/features/authentication/two-factor/application/contracts/twoFactor.contracts';
import type { TwoFactorViewDto } from '@/features/authentication/two-factor/application/dtos/twoFactor.dto';
import { mapTwoFactorViewDto } from '@/features/authentication/two-factor/infrastructure/mappers/mapTwoFactorViewDto';

export class JsonTwoFactorContentProvider implements TwoFactorContentProvider {
  private readonly view: TwoFactorViewDto;

  constructor() {
    this.view = mapTwoFactorViewDto(rawView);
  }

  getView(): TwoFactorViewDto {
    return this.view;
  }
}
