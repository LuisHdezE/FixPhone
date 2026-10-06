import type { TwoFactorCommandDto, TwoFactorResultDto, TwoFactorViewDto } from '../dtos/twoFactor.dto';

export interface TwoFactorContentProvider { getView(): TwoFactorViewDto; }
export interface TwoFactorGateway { verifyCode(command: TwoFactorCommandDto): Promise<TwoFactorResultDto>; }
