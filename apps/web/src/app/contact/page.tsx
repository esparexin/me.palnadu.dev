import {SectionHeading} from '@me-palnadu/ui';
import {Navigation} from '../../components/navigation';
import {PhaseNotice} from '../../components/phase-notice';

export const metadata = {title: 'Contact'};

const CONTENTS = [
  'Form posting to the API with server-side validation',
  'Rate limiting and a honeypot field',
  'No third-party tracking on the public form',
] as const;

export default function Page() {
  return (
    <>
      <Navigation />
      <main id="main-content">
        <section className="mx-auto max-w-page px-5 py-24 md:px-8">
          <SectionHeading as="h1" eyebrow="Kalyan V Medaboina" title="Contact" />
          <PhaseNotice phase="Phase 6" contents={CONTENTS} />
        </section>
      </main>
    </>
  );
}
