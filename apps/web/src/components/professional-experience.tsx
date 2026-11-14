'use client';

import {useState} from 'react';
import {EXPERIENCE_BY_ID, EXPERIENCE_ITEMS, type ExperienceItem} from '@/lib/experience';
import {COMPETENCY_BY_ID} from '@/lib/competencies';
import {ExperienceDetailDialog, type ExperienceDetail} from './experience-detail-dialog';
import {ExperienceEntry} from './experience-entry';
import {Container, SectionHeading, cn} from '@me-palnadu/ui';
import {TRIGGER_CLEARANCE} from '../lib/floating-trigger';
import {MoltenRingCarousel, type MoltenRingItem} from './ui/molten-ring-carousel';

export const CAREER_MOLTEN_ITEMS: MoltenRingItem[] = [
  {
    image: '/experience/zazz-it-solutions.svg',
    title: 'Zazz IT Solutions',
    meta: 'System Administrator · 2024–2026 · 100+ Mac Fleet · Jamf & Intune',
    detailId: 'zazz-it-solutions',
  },
  {
    image: '/experience/esf-labs.svg',
    title: 'eSF Labs Limited',
    meta: 'Security Analyst L1 · 2022–2023 · 50+ VAPT Engagements · OWASP',
    detailId: 'esf-labs',
  },
  {
    image: '/experience/usp.svg',
    title: 'United States Pharmacopeia',
    meta: 'Helpdesk Engineer L2 · 2018–2021 · 500+ Mac Support · AD & VDI',
    detailId: 'usp',
  },
  {
    image: '/experience/brandpier.svg',
    title: 'BrandPier Software',
    meta: 'System Administrator · 2016–2018 · Infrastructure & DR',
    detailId: 'brandpier',
  },
  {
    image: '/competencies/jamf-mdm.svg',
    title: 'Apple Device Management',
    meta: 'Zero Touch ADE/DEP · PreStage Enrollments · CIS Benchmark',
    detailId: 'apple-device-management',
  },
  {
    image: '/competencies/endpoint-security.svg',
    title: 'Endpoint Security Operations',
    meta: 'CIS Hardening · FileVault · VAPT · Compliance Auditing',
    detailId: 'endpoint-security-operations',
  },
];

/**
 * The detail a ring card stands for.
 *
 * A role carries the detail of the role itself; a competency carries its own.
 * Both come from the data files, so a card and its detail cannot drift apart.
 */
const detailFor = (detailId: string | undefined): ExperienceDetail | null => {
  if (detailId === undefined) return null;
  const role = EXPERIENCE_BY_ID.get(detailId);
  if (role !== undefined) return role.detail;
  return COMPETENCY_BY_ID.get(detailId)?.detail ?? null;
};

/**
 * Professional Experience section.
 *
 * Displays employment history in chronological order (newest first) with
 * click-to-expand detail panels and interactive 3D Molten Ring carousel.
 * Desktop uses a centered modal; mobile uses a bottom-up sheet (UI_UX_STANDARDS 7.3).
 *
 * `fullScreen` makes the section fill the viewport, which is how the dedicated
 * experience page presents it: the ring is the thing on the screen, and the
 * list below it is the index.
 */
export function ProfessionalExperience({
  headingLevel = 'h2',
  fullScreen = false,
}: {
  headingLevel?: 'h1' | 'h2';
  fullScreen?: boolean;
} = {}) {
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [openerElement, setOpenerElement] = useState<HTMLElement | null>(null);
  const [openDetailContent, setOpenDetailContent] = useState<ExperienceDetail | null>(null);

  const handleOpen = (key: string, detail: ExperienceDetail, trigger: HTMLElement | null) => {
    setOpenDetailContent(detail);
    setOpenerElement(trigger);
    setOpenDetail(key);
  };

  const handleOpenItem = (item: ExperienceItem, trigger: HTMLElement) => {
    handleOpen(item.id, item.detail, trigger);
  };

  const handleSelectCard = (index: number) => {
    const detailId = CAREER_MOLTEN_ITEMS[index]?.detailId;
    if (detailId === undefined) return;
    const detail = detailFor(detailId);
    if (detail === null) return;
    handleOpen(detailId, detail, null);
  };

  return (
    <section
      id="experience"
      className={cn(
        'border-t border-border-subtle bg-surface',
        fullScreen ? 'flex min-h-screen flex-col py-10 md:py-12' : 'py-20',
      )}
      aria-labelledby="experience-heading"
    >
      <Container
        as="div"
        className={cn('flex flex-col gap-12 max-w-7xl', fullScreen && 'flex-1 gap-8')}
      >
        <SectionHeading
          id="experience-heading"
          eyebrow="Professional Experience"
          title="Career History"
          as={headingLevel}
          className={TRIGGER_CLEARANCE}
          description="Four roles across Apple fleet administration, endpoint security, vulnerability assessment, and infrastructure operations — spanning eight years in Hyderabad and Vijayawada."
        />

        {/* 3D Molten Ring Carousel showcasing Career History milestones */}
        <div
          className={cn(
            'flex w-full flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-inverse shadow-md',
            fullScreen ? 'min-h-[60vh] flex-1' : 'h-[28rem] sm:h-[32rem]',
          )}
        >
          <MoltenRingCarousel
            items={CAREER_MOLTEN_ITEMS}
            aria-label="Career history"
            onCardOpen={handleSelectCard}
            arc={1.05}
            cardSize={0.22}
            cardRatio={0.67}
            fuse={0.09}
          />
        </div>

        <div
          className={cn('flex flex-col gap-4', TRIGGER_CLEARANCE)}
          role="list"
          aria-label="Professional experience entries"
        >
          {EXPERIENCE_ITEMS.map((item) => (
            <ExperienceEntry
              key={item.id}
              item={item}
              isOpen={openDetail === item.id}
              onOpen={(trigger) => handleOpenItem(item, trigger)}
            />
          ))}
        </div>

        <ExperienceDetailDialog
          id={openDetail !== null ? `${openDetail}-detail` : undefined}
          open={openDetail !== null && openDetailContent !== null}
          onClose={() => setOpenDetail(null)}
          detail={
            openDetailContent ?? {
              company: '',
              role: '',
              period: '',
              location: '',
              sections: [],
              technologies: [],
            }
          }
          opener={openerElement}
        />
      </Container>
    </section>
  );
}

export default ProfessionalExperience;
