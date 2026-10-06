import type {
  PasswordResetRequestDto,
  PasswordResetResultDto,
  PasswordResetViewDto,
} from '@/features/authentication/password-reset/application/dtos/passwordReset.dto';

export interface PasswordResetContentProvider {
  getView(): PasswordResetViewDto;
}

export interface PasswordResetGateway {
  requestReset(request: PasswordResetRequestDto): Promise<PasswordResetResultDto>;
}
