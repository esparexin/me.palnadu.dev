import { SectionHeading } from '@me-palnadu/ui';
import { Navigation } from '../../components/navigation';
import { PhaseNotice } from '../../components/phase-notice';

export const metadata = { title: 'Resume' };

const CONTENTS = [
  'Resume sections rendered from database records',
  'Download of the current resume document',
  'Structured data for search engines',
] as const;

export default function Page() {
  return (
    <>
      <Navigation />
      <main id="main-content">
        <section className="mx-auto max-w-page px-5 py-24 md:px-8">
          <SectionHeading as="h1" eyebrow="me.palnadu.dev" title="Resume" />
          <PhaseNotice phase="Phase 6" contents={CONTENTS} />
        </section>
      </main>
    </>
  );
}
