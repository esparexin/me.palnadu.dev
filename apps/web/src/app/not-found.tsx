import Link from 'next/link';
import {WEB_ROUTES} from '@me-palnadu/contracts';
import {SectionHeading} from '@me-palnadu/ui';
import {Navigation} from '../components/navigation';

export const metadata = {title: 'Page not found'};

/**
 * Renders for `notFound()` (a missing, draft, or archived article) and for an
 * unknown route. The default Next.js 404 drops all site chrome, so a visitor who
 * followed a stale link had no way back into the site.
 */
export default function WebNotFound() {
  return (
    <>
      <Navigation />
      <main id="main-content">
        <section className="mx-auto max-w-page px-5 py-16 md:px-8 md:py-24">
          <SectionHeading
            as="h1"
            eyebrow="me.palnadu.dev"
            title="Page not found"
            description="The page you asked for does not exist, or the article has not been published."
          />
          <p className="mt-10 text-body text-text-secondary">
            <Link
              href={WEB_ROUTES.knowledgeHub}
              className="text-accent-text underline underline-offset-2"
            >
              Browse the Knowledge Hub
            </Link>{' '}
            or return to the{' '}
            <Link href="/" className="text-accent-text underline underline-offset-2">
              home page
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  );
}
