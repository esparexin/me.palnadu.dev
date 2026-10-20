'use server';

import {redirect} from 'next/navigation';
import {GENERIC_LOGIN_FAILURE, LoginRequestSchema} from '@me-palnadu/contracts';
import {
  clearSessionCookie,
  getSessionToken,
  sanitizeRedirectPath,
  setSessionCookie,
} from './session';

export interface LoginActionState {
  error?: string | undefined;
}

export const loginAction = async (
  _prevState: LoginActionState | undefined,
  formData: FormData,
): Promise<LoginActionState> => {
  const email = formData.get('email');
  const password = formData.get('password');
  const redirectTo = formData.get('redirectTo');

  if (typeof email !== 'string' || typeof password !== 'string') {
    return {error: GENERIC_LOGIN_FAILURE};
  }

  const parsed = LoginRequestSchema.safeParse({email, password});
  if (!parsed.success) {
    return {error: GENERIC_LOGIN_FAILURE};
  }

  const apiBase = process.env['ADMIN_API_URL'] ?? 'http://localhost:4000';
  let target: string;

  try {
    const response = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        email: parsed.data.email,
        password: parsed.data.password,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      return {error: GENERIC_LOGIN_FAILURE};
    }

    const data: unknown = await response.json();
    if (
      typeof data !== 'object' ||
      data === null ||
      !('token' in data) ||
      typeof data.token !== 'string'
    ) {
      return {error: GENERIC_LOGIN_FAILURE};
    }

    await setSessionCookie(data.token);
    target = sanitizeRedirectPath(typeof redirectTo === 'string' ? redirectTo : null);
  } catch {
    return {error: GENERIC_LOGIN_FAILURE};
  }

  redirect(target);
};

export const logoutAction = async (): Promise<void> => {
  const token = await getSessionToken();
  const apiBase = process.env['ADMIN_API_URL'] ?? 'http://localhost:4000';

  if (token !== null) {
    try {
      await fetch(`${apiBase}/api/auth/logout`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`},
        cache: 'no-store',
      });
    } catch {
      // Clear cookie even if API fails or unreachable
    }
  }

  await clearSessionCookie();
  redirect('/login');
};
