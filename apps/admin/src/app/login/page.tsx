import { Container } from '@me-palnadu/ui';
import { PhaseNotice } from '../../components/phase-notice';

export const metadata = { title: 'Sign in' };

/**
 * Sign-in entry point.
 *
 * GitHub OAuth is implemented in Phase 6 together with the allowlist and the
 * server-to-server session flow in SECURITY.md section 4.4. No credential form,
 * no local password, and no placeholder "sign in" button that would suggest
 * authentication works before it exists.
 */
export default function LoginPage() {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center px-5 py-24">
      <Container measure className="!max-w-measure !px-0">
        <div className="rounded-lg border border-border-subtle bg-surface p-8">
          <h1 className="text-h2 font-semibold">Administrator sign-in</h1>
          <p className="mt-3 text-body text-text-secondary">
            Access is restricted to explicitly allowlisted GitHub accounts.
          </p>
          <PhaseNotice
            phase="Phase 6"
            contents={[
              'Auth.js with the GitHub OAuth provider',
              'Allowlist keyed on the immutable numeric GitHub id',
              'Server-side session validation on every API operation',
            ]}
          />
        </div>
      </Container>
    </main>
  );
}
