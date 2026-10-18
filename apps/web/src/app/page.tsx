import {ButtonLink, Container, SectionHeading} from '@me-palnadu/ui';
import {Navigation} from '../components/navigation';
import {PhaseNotice} from '../components/phase-notice';

/**
 * Home.
 *
 * The hero carries exactly the two required CTAs - View Resume and Explore
 * Experience - and nothing else, so the first viewport has a single purpose
 * (UI_UX_STANDARDS 7.1). Content sections are populated from the API in Phase 6;
 * the scaffold states that plainly rather than shipping filler content.
 */
export default function HomePage() {
  return (
    <>
      <Navigation />
      <main id="main-content">
        <section className="flex flex-col gap-8 pb-24 pt-16 md:pt-24">
          <Container as="div" className="flex flex-col gap-8">
            <p className="text-eyebrow font-semibold uppercase tracking-widest text-accent-text">
              Portfolio
            </p>
            <h1 className="text-display font-semibold">Endpoint management, done properly.</h1>
            <p className="mt-6 max-w-measure text-lead text-text-secondary">
              Career timeline, projects, resume, and a technical Knowledge Hub covering endpoint
              management, MDM, and security.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <ButtonLink href="/resume" size="lg">
                View Resume
              </ButtonLink>
              <ButtonLink href="/experience" size="lg" variant="secondary">
                Explore Experience
              </ButtonLink>
            </div>
          </Container>
        </section>

        <section className="border-t border-border-subtle bg-surface-subtle py-24">
          <Container as="div" className="flex flex-col gap-8">
            <SectionHeading
              eyebrow="Scope"
              title="Scaffolding is in place; content arrives next"
              description="This repository is at Phase 3. The governance baseline, shared contracts, design tokens, and UI primitives are merged and enforced by local gates. Career history, projects, and Knowledge Hub articles are published through the admin application in a later phase."
            />
            <PhaseNotice
              phase="Phase 6"
              contents={[
                'Public site reading published records from the API',
                'Desktop timeline and mobile swipe slider per UI_UX_STANDARDS section 7.3',
                'Floating menu with all four close paths per UI_UX_STANDARDS section 7.2',
              ]}
            />
          </Container>
        </section>
      </main>
      <footer className="border-t border-border-subtle py-10">
        <Container as="div">
          <p className="text-meta text-text-tertiary">me.palnadu.dev</p>
        </Container>
      </footer>
    </>
  );
}
