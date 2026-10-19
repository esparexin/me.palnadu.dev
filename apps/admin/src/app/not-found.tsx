import {ButtonLink, Container} from '@me-palnadu/ui';

export const metadata = {title: 'Not found'};

/** Unknown administration route. The default 404 has no chrome and no way back. */
export default function AdminNotFound() {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center py-24">
      <Container measure>
        <div className="rounded-lg border border-border-subtle bg-surface p-8 shadow-sm">
          <h1 className="text-h2 font-semibold text-text-primary">Page not found</h1>
          <p className="mt-2 text-body-sm text-text-secondary">
            This administration route does not exist.
          </p>
          <div className="mt-6">
            <ButtonLink href="/dashboard">Back to the dashboard</ButtonLink>
          </div>
        </div>
      </Container>
    </main>
  );
}
