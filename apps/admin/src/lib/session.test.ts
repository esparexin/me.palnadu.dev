import {describe, expect, it, vi, beforeEach} from 'vitest';
import {
  clearSessionCookie,
  getAuthenticatedAdmin,
  getSessionCookieName,
  getSessionToken,
  sanitizeRedirectPath,
  setSessionCookie,
} from './session';
import {SESSION_COOKIE_NAME} from '@me-palnadu/contracts';

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

describe('admin session utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeRedirectPath', () => {
    it('allows safe relative paths', () => {
      expect(sanitizeRedirectPath('/dashboard')).toBe('/dashboard');
      expect(sanitizeRedirectPath('/dashboard/settings')).toBe('/dashboard/settings');
    });

    it('rejects external and malformed open-redirect attempts', () => {
      expect(sanitizeRedirectPath('https://evil.com')).toBe('/dashboard');
      expect(sanitizeRedirectPath('//evil.com')).toBe('/dashboard');
      expect(sanitizeRedirectPath('/\\evil.com')).toBe('/dashboard');
      expect(sanitizeRedirectPath('javascript:alert(1)')).toBe('/dashboard');
      expect(sanitizeRedirectPath('')).toBe('/dashboard');
      expect(sanitizeRedirectPath(null)).toBe('/dashboard');
      expect(sanitizeRedirectPath(undefined)).toBe('/dashboard');
    });
  });

  describe('getSessionCookieName', () => {
    it('returns production cookie name when NODE_ENV is production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(getSessionCookieName()).toBe(SESSION_COOKIE_NAME);
      vi.unstubAllEnvs();
    });

    it('returns development cookie name when NODE_ENV is not production', () => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(getSessionCookieName()).toBe('me-palnadu-admin.session');
      vi.unstubAllEnvs();
    });
  });

  describe('cookie helpers', () => {
    it('reads session token from cookie store', async () => {
      mockCookieStore.get.mockReturnValue({value: 'test-token'});
      const token = await getSessionToken();
      expect(token).toBe('test-token');
    });

    it('returns null when cookie is absent', async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      const token = await getSessionToken();
      expect(token).toBeNull();
    });

    it('sets cookie with expected security attributes', async () => {
      await setSessionCookie('secure-token-value');
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.any(String),
        'secure-token-value',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
    });

    it('deletes session cookies on clear', async () => {
      await clearSessionCookie();
      expect(mockCookieStore.delete).toHaveBeenCalled();
    });
  });

  describe('getAuthenticatedAdmin', () => {
    it('returns null if token is missing', async () => {
      mockCookieStore.get.mockReturnValue(undefined);
      const admin = await getAuthenticatedAdmin();
      expect(admin).toBeNull();
    });

    it('returns administrator data when API validates session', async () => {
      mockCookieStore.get.mockReturnValue({value: 'valid-token'});
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          administrator: {
            id: 'admin_123',
            email: 'owner@me.palnadu.dev',
            role: 'owner',
            sessionId: 'sess_456',
          },
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const admin = await getAuthenticatedAdmin();
      expect(admin).toEqual({
        id: 'admin_123',
        email: 'owner@me.palnadu.dev',
        role: 'owner',
        sessionId: 'sess_456',
      });

      vi.unstubAllGlobals();
    });

    it('returns null if API rejects session', async () => {
      mockCookieStore.get.mockReturnValue({value: 'invalid-token'});
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });
      vi.stubGlobal('fetch', fetchMock);

      const admin = await getAuthenticatedAdmin();
      expect(admin).toBeNull();

      vi.unstubAllGlobals();
    });
  });
});
