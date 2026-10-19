import type {ReactNode} from 'react';
import {Button, Container} from '@me-palnadu/ui';
import {logoutAction} from '../../lib/actions';
import {requireAdmin} from '../../lib/session';
import {DashboardNav} from '../../components/dashboard/nav';

/**
 * The authenticated shell.
 *
 * Protection lives here once, not in every page: a page added below this layout
 * cannot forget to check the session. The API still re-checks every request, so a
 * compromised render is not a compromised write.
 */
export default async function DashboardLayout({children}: {children: ReactNode}) {
  const admin = await requireAdmin('/dashboard');

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-border-subtle bg-surface lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4 lg:block">
          <div>
            <p className="text-eyebrow uppercase tracking-wider text-text-tertiary">
              me.palnadu.dev
            </p>
            <p className="mt-1 text-body-sm font-semibold text-text-primary">Admin Control</p>
          </div>
        </div>
        <div className="px-3 pb-4 lg:px-3">
          <DashboardNav role={admin.role} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-border-subtle bg-surface">
          <Container className="flex items-center justify-end gap-4 px-5 py-3 lg:px-8">
            <div className="text-right">
              <p className="text-body-sm font-medium text-text-primary">{admin.email}</p>
              <p className="text-meta text-text-tertiary">{admin.role}</p>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Sign out
              </Button>
            </form>
          </Container>
        </header>

        <main id="main-content" className="px-5 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto flex w-full max-w-page flex-col gap-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
