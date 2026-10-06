import rawView from '@/features/authentication/password-reset/infrastructure/password-reset.view.json';
import type { PasswordResetContentProvider } from '@/features/authentication/password-reset/application/contracts/passwordReset.contracts';
import type { PasswordResetViewDto } from '@/features/authentication/password-reset/application/dtos/passwordReset.dto';
import { mapPasswordResetViewDto } from '@/features/authentication/password-reset/infrastructure/mappers/mapPasswordResetViewDto';

export class JsonPasswordResetContentProvider implements PasswordResetContentProvider {
  private readonly view: PasswordResetViewDto;

  constructor() {
    this.view = mapPasswordResetViewDto(rawView);
  }

  getView(): PasswordResetViewDto {
    return this.view;
  }
}
