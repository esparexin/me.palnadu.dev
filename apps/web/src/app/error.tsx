'use client';

import {useEffect} from 'react';
import {Button, SectionHeading} from '@me-palnadu/ui';
import {Navigation} from '../components/navigation';

/**
 * Root error boundary for the public site. An API outage on the Knowledge Hub
 * article route lands here with a retry instead of the unhandled exception
 * default (CODING_STANDARDS.md section 4).
 */
export default function WebError({error, retry}: {error: unknown; retry: () => void}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <Navigation />
      <main id="main-content">
        <section className="mx-auto max-w-page px-5 py-16 md:px-8 md:py-24">
          <SectionHeading
            as="h1"
            eyebrow="me.palnadu.dev"
            title="Something went wrong"
            description="This page could not be loaded. The rest of the site is unaffected; try again in a moment."
          />
          <div className="mt-10">
            <Button onClick={() => retry()}>Try again</Button>
          </div>
        </section>
      </main>
    </>
  );
}
