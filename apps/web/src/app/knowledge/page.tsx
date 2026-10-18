import { SectionHeading } from '@me-palnadu/ui';
import { Navigation } from '../../components/navigation';
import { PhaseNotice } from '../../components/phase-notice';

export const metadata = { title: 'Knowledge Hub' };

const CONTENTS = [
  'Articles grouped by kind: tutorials, KT guides, troubleshooting, interview preparation',
  'Draft articles stay private until an administrator publishes them',
  'Reading time computed by packages/shared, never stored twice',
] as const;

export default function Page() {
  return (
    <>
      <Navigation />
      <main id="main-content">
        <section className="mx-auto max-w-page px-5 py-24 md:px-8">
          <SectionHeading as="h1" eyebrow="me.palnadu.dev" title="Knowledge Hub" />
          <PhaseNotice phase="Phase 6" contents={CONTENTS} />
        </section>
      </main>
    </>
  );
}
