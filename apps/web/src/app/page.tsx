import {Navigation} from '../components/navigation';
import {PortfolioHero} from '../components/portfolio-hero';
import {ProfessionalExperience} from '../components/professional-experience';

/**
 * Home (About me).
 *
 * The hero carries the 21st.dev inspired portfolio centerpiece for Kalyan V Medaboina
 * with his portrait photo and layered typography, carrying exactly the two required CTAs -
 * View Resume and Explore Experience - so the first viewport has a single clear purpose
 * (UI_UX_STANDARDS 7.1). Below the hero, the Professional Experience section presents
 * Kalyan's career history in reverse chronological order with expandable detail panels.
 */
export default function HomePage() {
  return (
    <>
      <Navigation />
      <main id="main-content">
        <PortfolioHero eyebrow="About me" />
        <ProfessionalExperience />
      </main>
      <footer className="border-t border-border-subtle py-10">
        <p className="text-meta text-text-tertiary text-center">Kalyan V Medaboina</p>
      </footer>
    </>
  );
}
