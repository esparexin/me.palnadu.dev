import {Container, SectionHeading} from '@me-palnadu/ui';
import {Navigation} from '../components/navigation';
import {PhaseNotice} from '../components/phase-notice';
import {PortfolioHero} from '../components/portfolio-hero';
import {MoltenRingCarousel} from '../components/ui/molten-ring-carousel';
import {COMPETENCY_ITEMS} from '../components/ui/molten-ring-carousel.demo';

/**
 * Home (About me).
 *
 * The hero carries the 21st.dev inspired portfolio centerpiece for Kalyan V Medaboina
 * with his portrait photo and layered typography, carrying exactly the two required CTAs -
 * View Resume and Explore Experience - so the first viewport has a single clear purpose
 * (UI_UX_STANDARDS 7.1). Below the hero, the Molten Ring Carousel showcases Kalyan's
 * Core Competencies across Jamf, Apple MDM, Intune, Endpoint Security, and ISO 27001.
 */
export default function HomePage() {
  return (
    <>
      <Navigation />
      <main id="main-content">
        <PortfolioHero eyebrow="About me" />

        <section
          id="content-section"
          className="border-t border-border-subtle bg-surface py-20"
          aria-labelledby="competencies-heading"
        >
          <Container as="div" className="flex flex-col gap-8">
            <SectionHeading
              eyebrow="Core Competencies"
              title="Enterprise Endpoint & Security Architecture"
              description="Deep hands-on expertise managing Apple fleets with Jamf Pro and enterprise devices via Microsoft Intune, backed by CIS hardening, Zero Touch Deployment, and ISO 27001 compliance."
            />
            <div className="h-[28rem] w-full overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-sm">
              <MoltenRingCarousel
                items={COMPETENCY_ITEMS}
                brand="Kalyan V Medaboina"
                arc={1.05}
                cardSize={0.22}
                cardRatio={0.67}
                fuse={0.09}
              />
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
          <p className="text-meta text-text-tertiary">Kalyan V Medaboina</p>
        </Container>
      </footer>
    </>
  );
}
