import {describe, expect, it, vi, beforeEach} from 'vitest';
import {loginAction, logoutAction} from './actions';
import {GENERIC_LOGIN_FAILURE} from '@me-palnadu/contracts';

const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

describe('admin server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loginAction', () => {
    it('returns generic error when email is missing or empty', async () => {
      const formData = new FormData();
      formData.set('password', 'SecretPassword123!');

      const result = await loginAction(undefined, formData);
      expect(result).toEqual({error: GENERIC_LOGIN_FAILURE});
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('returns generic error when email format is invalid', async () => {
      const formData = new FormData();
      formData.set('email', 'not-an-email');
      formData.set('password', 'SecretPassword123!');

      const result = await loginAction(undefined, formData);
      expect(result).toEqual({error: GENERIC_LOGIN_FAILURE});
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('returns generic error when API responds with 401', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });
      vi.stubGlobal('fetch', fetchMock);

      const formData = new FormData();
      formData.set('email', 'owner@me.palnadu.dev');
      formData.set('password', 'WrongPassword123!');

      const result = await loginAction(undefined, formData);
      expect(result).toEqual({error: GENERIC_LOGIN_FAILURE});
      expect(mockRedirect).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('sets session cookie and redirects on successful authentication', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          token: 'signed-jwt-token-xyz',
          administrator: {
            id: 'admin_1',
            email: 'owner@me.palnadu.dev',
            role: 'owner',
            sessionId: 'sess_1',
          },
          expiresInSeconds: 28_800,
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const formData = new FormData();
      formData.set('email', 'owner@me.palnadu.dev');
      formData.set('password', 'ValidSecretPassword123!');
      formData.set('redirectTo', '/dashboard/experience');

      await loginAction(undefined, formData);

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        expect.any(String),
        'signed-jwt-token-xyz',
        expect.anything(),
      );
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard/experience');

      vi.unstubAllGlobals();
    });
  });

  describe('logoutAction', () => {
    it('notifies API, clears cookie and redirects to /login', async () => {
      mockCookieStore.get.mockReturnValue({value: 'active-session-token'});
      const fetchMock = vi.fn().mockResolvedValue({ok: true});
      vi.stubGlobal('fetch', fetchMock);

      await logoutAction();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          headers: {Authorization: 'Bearer active-session-token'},
        }),
      );
      expect(mockCookieStore.delete).toHaveBeenCalled();
      expect(mockRedirect).toHaveBeenCalledWith('/login');

      vi.unstubAllGlobals();
    });
  });
});
