'use client';

import {useEffect} from 'react';
import {Button, Container} from '@me-palnadu/ui';

/**
 * Root error boundary. `getAuthenticatedAdmin` throws when the API is unreachable
 * or answers 5xx, so the failure lands here with a retry rather than being
 * misreported as a signed-out visitor (CODING_STANDARDS.md section 4).
 */
export default function AdminError({error, retry}: {error: unknown; retry: () => void}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center py-24">
      <Container measure>
        <div className="rounded-lg border border-border-subtle bg-surface p-8 shadow-sm">
          <h1 className="text-h2 font-semibold text-text-primary">Something went wrong</h1>
          <p className="mt-2 text-body-sm text-text-secondary">
            The administration API could not be reached or answered with an error. Your session has
            not been changed; retry once the API is available.
          </p>
          <div className="mt-6">
            <Button onClick={() => retry()}>Try again</Button>
          </div>
        </div>
      </Container>
    </main>
  );
}
