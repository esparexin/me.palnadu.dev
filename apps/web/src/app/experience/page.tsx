import {Navigation} from '../../components/navigation';
import {ProfessionalExperience} from '../../components/professional-experience';

export const metadata = {title: 'Career timeline'};

export default function ExperiencePage() {
  return (
    <>
      <Navigation />
      <main id="main-content">
        <ProfessionalExperience headingLevel="h1" />
      </main>
      <footer className="border-t border-border-subtle py-10">
        <p className="text-meta text-text-tertiary text-center">Kalyan V Medaboina</p>
      </footer>
    </>
  );
}
