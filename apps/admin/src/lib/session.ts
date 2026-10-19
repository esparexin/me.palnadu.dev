import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {
  AdminSessionResponseSchema,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  type AdminIdentity,
} from '@me-palnadu/contracts';

export const getSessionCookieName = (): string =>
  process.env['NODE_ENV'] === 'production' ? SESSION_COOKIE_NAME : 'me-palnadu-admin.session';

export const getSessionToken = async (): Promise<string | null> => {
  const cookieStore = await cookies();
  const token =
    cookieStore.get(getSessionCookieName())?.value ??
    cookieStore.get('me-palnadu-admin.session')?.value ??
    cookieStore.get(SESSION_COOKIE_NAME)?.value;

  return token ?? null;
};

export const setSessionCookie = async (token: string): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
};

export const clearSessionCookie = async (): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.delete(getSessionCookieName());
  cookieStore.delete('me-palnadu-admin.session');
  cookieStore.delete(SESSION_COOKIE_NAME);
};

export const sanitizeRedirectPath = (target: string | null | undefined): string => {
  if (typeof target !== 'string' || target.length === 0) return '/dashboard';
  // Open redirect defense: must start with single '/', no protocol relative '//', no backslashes, no scheme
  if (
    !target.startsWith('/') ||
    target.startsWith('//') ||
    target.startsWith('/\\') ||
    target.includes(':')
  ) {
    return '/dashboard';
  }
  return target;
};

export const getAuthenticatedAdmin = async (): Promise<AdminIdentity | null> => {
  const token = await getSessionToken();
  if (token === null) return null;

  const apiBase = process.env['ADMIN_API_URL'] ?? 'http://localhost:4000';
  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/auth/session`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
  } catch {
    throw new Error('The administration API is unreachable.');
  }

  // Only a rejected credential means "not signed in". A throttled or failing API is
  // an outage: treating it as signed out signed the administrator out silently and
  // hid the failure behind the login screen (CODING_STANDARDS.md section 4).
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`The administration API answered with status ${response.status}.`);
  }
  const body: unknown = await response.json();
  const parsed = AdminSessionResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error('The session response did not match the published contract.');
  }
  return parsed.data.administrator;
};

/**
 * Resolves the administrator or sends the browser to sign in.
 *
 * Used by the dashboard layout, so every page below it is protected by one check
 * rather than by a copy of this logic in each page.
 */
export const requireAdmin = async (currentPath: string): Promise<AdminIdentity> => {
  const admin = await getAuthenticatedAdmin();
  if (admin === null) {
    redirect(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
  }
  return admin;
};
