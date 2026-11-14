import {redirect} from 'next/navigation';
import {Container} from '@me-palnadu/ui';
import {LoginForm} from '../../components/login-form';
import {getAuthenticatedAdmin, sanitizeRedirectPath} from '../../lib/session';

export const metadata = {title: 'Sign in'};

interface LoginPageProps {
  searchParams: Promise<{
    redirectTo?: string | string[];
    from?: string | string[];
  }>;
}

export default async function LoginPage({searchParams}: LoginPageProps) {
  const admin = await getAuthenticatedAdmin();
  const params = await searchParams;
  const rawTarget =
    typeof params.redirectTo === 'string'
      ? params.redirectTo
      : typeof params.from === 'string'
        ? params.from
        : undefined;

  const redirectTo = sanitizeRedirectPath(rawTarget);

  if (admin !== null) {
    redirect(redirectTo);
  }

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center py-24">
      <Container measure>
        <div className="rounded-lg border border-border-subtle bg-surface p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-h2 font-semibold text-text-primary">Administrator sign-in</h1>
            <p className="mt-2 text-body-sm text-text-secondary">
              Single-owner administration dashboard. Enter your credentials to continue.
            </p>
          </div>
          <LoginForm redirectTo={redirectTo} />
        </div>
      </Container>
    </main>
  );
}
