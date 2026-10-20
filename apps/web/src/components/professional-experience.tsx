'use client';

import {useState} from 'react';
import Image from 'next/image';
import {EXPERIENCE_ITEMS, type ExperienceItem} from '@/lib/experience';
import {ExperienceDetailDialog, type ExperienceDetail} from './experience-detail-dialog';
import {Container, SectionHeading} from '@me-palnadu/ui';
import {MoltenRingCarousel, type MoltenRingItem} from './ui/molten-ring-carousel';

export const CAREER_MOLTEN_ITEMS: MoltenRingItem[] = [
  {
    image: '/experience/zazz-it-solutions.svg',
    title: 'Zazz IT Solutions',
    meta: 'System Administrator · 2024–2026 · 100+ Mac Fleet · Jamf & Intune',
  },
  {
    image: '/experience/esf-labs.svg',
    title: 'eSF Labs Limited',
    meta: 'Security Analyst L1 · 2022–2023 · 50+ VAPT Engagements · OWASP',
  },
  {
    image: '/experience/usp.svg',
    title: 'United States Pharmacopeia',
    meta: 'Helpdesk Engineer L2 · 2018–2021 · 500+ Mac Support · AD & VDI',
  },
  {
    image: '/experience/brandpier.svg',
    title: 'BrandPier Software',
    meta: 'System Administrator · 2016–2018 · Infrastructure & DR',
  },
  {
    image: '/competencies/jamf-mdm.svg',
    title: 'Apple Device Management',
    meta: 'Zero Touch ADE/DEP · PreStage Enrollments · CIS Benchmark',
  },
  {
    image: '/competencies/endpoint-security.svg',
    title: 'Endpoint Security Operations',
    meta: 'CIS Hardening · FileVault · VAPT · Compliance Auditing',
  },
];

/**
 * Professional Experience section.
 *
 * Displays employment history in chronological order (newest first) with
 * click-to-expand detail panels and interactive 3D Molten Ring carousel.
 * Desktop uses a centered modal; mobile uses a bottom-up sheet (UI_UX_STANDARDS 7.3).
 */
export function ProfessionalExperience({
  headingLevel = 'h2',
}: {
  headingLevel?: 'h1' | 'h2';
} = {}) {
  const [openDetail, setOpenDetail] = useState<ExperienceItem | null>(null);
  const [openerElement, setOpenerElement] = useState<HTMLElement | null>(null);
  const initialDetail: ExperienceDetail = EXPERIENCE_ITEMS[0]?.detail ?? {
    company: '',
    role: '',
    period: '',
    location: '',
    sections: [],
    technologies: [],
  };
  const [openDetailContent, setOpenDetailContent] = useState<ExperienceDetail>(initialDetail);

  const handleOpen = (item: ExperienceItem, trigger: HTMLElement) => {
    setOpenDetailContent(item.detail);
    setOpenerElement(trigger);
    setOpenDetail(item);
  };

  return (
    <section
      id="experience"
      className="border-t border-border-subtle bg-surface py-20"
      aria-labelledby="experience-heading"
    >
      <Container as="div" className="flex flex-col gap-12 max-w-7xl">
        <SectionHeading
          id="experience-heading"
          eyebrow="Professional Experience"
          title="Career History"
          as={headingLevel}
          description="Four roles across Apple fleet administration, endpoint security, vulnerability assessment, and infrastructure operations — spanning eight years in Hyderabad and Vijayawada."
        />

        {/* 3D Molten Ring Carousel showcasing Career History milestones */}
        <div className="h-[28rem] sm:h-[32rem] w-full overflow-hidden rounded-2xl border border-border-subtle bg-surface-inverse shadow-md">
          <MoltenRingCarousel
            items={CAREER_MOLTEN_ITEMS}
            brand="Career Journey"
            arc={1.05}
            cardSize={0.22}
            cardRatio={0.67}
            fuse={0.09}
          />
        </div>

        <div
          className="divide-y divide-border-subtle"
          role="list"
          aria-label="Professional experience entries"
        >
          {EXPERIENCE_ITEMS.map((item) => (
            <ExperienceEntry
              key={item.id}
              item={item}
              isOpen={openDetail?.id === item.id}
              onOpen={(trigger) => handleOpen(item, trigger)}
            />
          ))}
        </div>

        <ExperienceDetailDialog
          id={openDetail ? `${openDetail.id}-detail` : undefined}
          open={openDetail !== null}
          onClose={() => setOpenDetail(null)}
          detail={openDetailContent}
          opener={openerElement}
        />
      </Container>
    </section>
  );
}

interface ExperienceEntryProps {
  item: ExperienceItem;
  isOpen: boolean;
  onOpen: (trigger: HTMLElement) => void;
}

function ExperienceEntry({item, isOpen, onOpen}: ExperienceEntryProps) {
  return (
    <article className="py-8 first:pt-0" role="listitem">
      <button
        type="button"
        onClick={(e) => {
          e.currentTarget.focus();
          onOpen(e.currentTarget);
        }}
        className="group w-full flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus rounded-lg"
        aria-haspopup="dialog"
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-controls={`${item.id}-detail`}
      >
        <div className="flex items-start lg:items-center gap-4 min-w-0 flex-1">
          <div
            className="flex-shrink-0 w-14 h-14 lg:w-16 lg:h-16 rounded-lg border border-border-subtle bg-surface-subtle overflow-hidden flex items-center justify-center"
            aria-hidden="true"
          >
            <Image
              src={item.logo}
              alt={item.logoAlt}
              width={56}
              height={56}
              className="object-contain p-2"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div
              className="hidden w-full h-full flex items-center justify-center text-accent"
              aria-hidden="true"
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 17" />
              </svg>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-h3 font-semibold text-text-primary truncate lg:truncate">
              {item.company}
            </h3>
            <p className="mt-1 text-body-sm text-text-secondary flex flex-wrap gap-3">
              <span>{item.period}</span>
              <span aria-hidden="true">·</span>
              <span>{item.location}</span>
            </p>
            <p className="mt-1 text-body text-text-primary">{item.role}</p>
          </div>
        </div>
        <div
          className="flex-shrink-0 flex items-center gap-2 text-accent font-medium text-body-sm opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-fast lg:opacity-100"
          aria-hidden="true"
        >
          <span>View Experience</span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="group-hover:translate-x-1 transition-transform duration-fast"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    </article>
  );
}

export default ProfessionalExperience;
