import { setAdminToken } from '@/auth/adminApiSession';
import type { SignInGateway } from '../application/contracts/signIn.contracts';
import type { SignInCredentialsDto, SignInResultDto } from '../application/dtos/signIn.dto';

type LoginResponse = { data?: { access_token?: string; user?: { permissions?: string[] } } };

export class ApiSignInGateway implements SignInGateway {
  async signIn(credentials: SignInCredentialsDto): Promise<SignInResultDto> {
    let response: Response;
    try {
      response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: credentials.email.trim(),
          password: credentials.password,
          device_name: 'fixphone-web-admin',
        }),
      });
    } catch {
      return { status: 'failure', reason: 'unavailable' };
    }

    if (response.status === 401 || response.status === 422) {
      return { status: 'failure', reason: 'invalid-credentials' };
    }
    if (!response.ok) {
      return { status: 'failure', reason: 'unavailable' };
    }

    const payload = await response.json() as LoginResponse;
    const token = payload.data?.access_token;
    if (!token) return { status: 'failure', reason: 'unavailable' };

    // Only admin-authorized sessions should be retained for this feature.
    if (!payload.data?.user?.permissions?.includes('valuation.manage')) {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
      }).catch(() => undefined);
      return { status: 'failure', reason: 'unavailable' };
    }
    setAdminToken(token);
    return { status: 'success' };
  }
}
