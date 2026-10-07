export interface StorefrontCustomerSession {
  name: string;
  email: string;
  phone?: string;
}

export interface StorefrontSessionSubmission {
  name?: string | undefined;
  email: string;
  phone?: string | undefined;
  password: string;
}

export interface StorefrontSessionResult {
  session?: StorefrontCustomerSession;
  errors: Readonly<Record<string, string>>;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function createStorefrontCustomerSession(
  mode: 'sign-in' | 'register',
  submission: StorefrontSessionSubmission,
): StorefrontSessionResult {
  const email = submission.email.trim().toLowerCase();
  const name = submission.name?.trim() ?? '';
  const phone = submission.phone?.trim() ?? '';
  const password = submission.password;

  const errors: Record<string, string> = {};

  if (!isValidEmail(email)) errors.email = 'Ingresa un correo válido.';
  if (password.length < 4) errors.password = 'Usa al menos 4 caracteres.';
  if (mode === 'register' && name.length < 2) errors.name = 'Ingresa tu nombre.';
  if (mode === 'register' && phone && phone.length < 6) errors.phone = 'Revisa el teléfono ingresado.';

  if (Object.keys(errors).length > 0) return { errors };

  return {
    session: {
      name: mode === 'register' ? name : email.split('@')[0] || 'Cliente',
      email,
      ...(phone ? { phone } : {}),
    },
    errors: {},
  };
}
