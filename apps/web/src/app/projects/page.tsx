import { SectionHeading } from '@me-palnadu/ui';
import { Navigation } from '../../components/navigation';
import { PhaseNotice } from '../../components/phase-notice';

export const metadata = { title: 'Projects' };

const CONTENTS = [
  'Index and detail routes backed by published project records',
  'Tech tags, links, and cover imagery',
  'Featured projects surfaced on the home page',
] as const;

export default function Page() {
  return (
    <>
      <Navigation />
      <main id="main-content">
        <section className="mx-auto max-w-page px-5 py-24 md:px-8">
          <SectionHeading as="h1" eyebrow="me.palnadu.dev" title="Projects" />
          <PhaseNotice phase="Phase 6" contents={CONTENTS} />
        </section>
      </main>
    </>
  );
}
