import {API_ROUTES, AdminSessionListSchema, type AdminSessionList} from '@me-palnadu/contracts';
import {Badge} from '@me-palnadu/ui';
import {adminApiFetch, describeActionError} from '../../../lib/api';
import {requireAdmin} from '../../../lib/session';
import {formatDateTime} from '../../../lib/format';
import {changePasswordAction, revokeSessionAction} from '../../../lib/security-actions';
import {ChangePasswordForm} from '../../../components/dashboard/change-password-form';
import {ConfirmButton} from '../../../components/dashboard/confirm-button';
import {Notice, PageHeader} from '../../../components/dashboard/ui';

export const metadata = {title: 'Security'};

interface PageProps {
  searchParams: Promise<{error?: string; notice?: string}>;
}

export default async function SecurityPage({searchParams}: PageProps) {
  await requireAdmin('/dashboard/security');
  const params = await searchParams;

  let sessions: AdminSessionList | undefined;
  let error: string | null = params.error ?? null;
  try {
    sessions = await adminApiFetch(API_ROUTES.auth.sessions, AdminSessionListSchema);
  } catch (caught) {
    error = describeActionError(caught);
  }

  return (
    <>
      <PageHeader
        title="Security"
        description="Sessions are database-backed and checked on every request. Revoking one takes effect immediately, not at token expiry."
      />

      {params.notice !== undefined && <Notice>{params.notice}</Notice>}
      {error !== null && <Notice tone="error">{error}</Notice>}

      <section aria-labelledby="sessions" className="flex flex-col gap-4">
        <h2 id="sessions" className="text-h3 font-semibold text-text-primary">
          Sessions
        </h2>

        {sessions === undefined ? (
          <p className="text-body-sm text-text-tertiary">Sessions could not be loaded.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sessions.sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body-sm font-medium text-text-primary">
                      Started {formatDateTime(session.createdAt)}
                    </span>
                    {session.current && <Badge tone="accent">Current</Badge>}
                    {session.revokedAt !== undefined && <Badge tone="neutral">Revoked</Badge>}
                  </div>
                  <p className="text-meta text-text-tertiary">
                    Last seen {formatDateTime(session.lastSeenAt)} · expires{' '}
                    {formatDateTime(session.expiresAt)}
                    {session.ip !== undefined && ` · ${session.ip}`}
                  </p>
                  {session.userAgent !== undefined && (
                    <p
                      className="max-w-xl truncate text-meta text-text-tertiary"
                      title={session.userAgent}
                    >
                      {session.userAgent}
                    </p>
                  )}
                </div>

                {session.revokedAt === undefined && (
                  <form action={revokeSessionAction.bind(null, session.sessionId)}>
                    <ConfirmButton
                      message={
                        session.current
                          ? 'This is your current session. Revoking it signs you out. Continue?'
                          : 'Revoke this session?'
                      }
                    >
                      {session.current ? 'Sign out this session' : 'Revoke'}
                    </ConfirmButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="password"
        className="flex flex-col gap-4 border-t border-border-subtle pt-8"
      >
        <h2 id="password" className="text-h3 font-semibold text-text-primary">
          Change password
        </h2>
        <ChangePasswordForm action={changePasswordAction} />
      </section>
    </>
  );
}
