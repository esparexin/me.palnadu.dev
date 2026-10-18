import {SectionHeading} from '@me-palnadu/ui';
import {Navigation} from '../../components/navigation';
import {PhaseNotice} from '../../components/phase-notice';

export const metadata = {title: 'Career timeline'};

const CONTENTS = [
  'Horizontal desktop timeline with hover previews and an independently scrollable popup',
  'Mobile bottom-to-top swipe slider with visible navigation controls',
  'Entries loaded from the API, ordered by compareExperience',
] as const;

export default function Page() {
  return (
    <>
      <Navigation />
      <main id="main-content">
        <section className="mx-auto max-w-page px-5 py-24 md:px-8">
          <SectionHeading as="h1" eyebrow="me.palnadu.dev" title="Career timeline" />
          <PhaseNotice phase="Phase 6" contents={CONTENTS} />
        </section>
      </main>
    </>
  );
}
