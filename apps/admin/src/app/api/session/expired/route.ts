import {NextResponse, type NextRequest} from 'next/server';
import {clearSessionCookie, sanitizeRedirectPath} from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  await clearSessionCookie();
  const target = sanitizeRedirectPath(request.nextUrl.searchParams.get('redirectTo'));
  const login = new URL('/login', request.url);
  login.searchParams.set('redirectTo', target);
  return NextResponse.redirect(login);
};
