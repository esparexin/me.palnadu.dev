'use client';

import {MoltenRingCarousel, type MoltenRingItem} from './molten-ring-carousel';

export const COMPETENCY_ITEMS: MoltenRingItem[] = [
  {
    image: '/competencies/jamf-mdm.svg',
    title: 'Jamf Pro & Apple MDM',
    meta: '100+ Managed Mac Fleet · 98% Patch Compliance',
  },
  {
    image: '/competencies/intune-cloud.svg',
    title: 'Microsoft Intune & Entra ID',
    meta: 'Conditional Access · MFA · Cloud Identity',
  },
  {
    image: '/competencies/zero-touch.svg',
    title: 'Zero Touch Deployment',
    meta: 'Apple Business Manager · ADE/DEP · PreStage',
  },
  {
    image: '/competencies/endpoint-security.svg',
    title: 'Endpoint Hardening',
    meta: 'CIS Benchmarks · FileVault · 99.5% Security Score',
  },
  {
    image: '/competencies/iso-governance.svg',
    title: 'ISO 27001 & Compliance',
    meta: 'Internal Controls · Risk Register · ITIL SLA',
  },
  {
    image: '/competencies/cyber-vapt.svg',
    title: 'VAPT & Threat Defense',
    meta: '50+ Engagements · QRadar SIEM · Recon',
  },
];

export function MoltenRingCarouselDemo() {
  return (
    <div className="h-[28rem] w-full">
      <MoltenRingCarousel
        items={COMPETENCY_ITEMS}
        brand="Core Competencies"
        arc={1.05}
        cardSize={0.22}
        cardRatio={0.67}
        fuse={0.09}
      />
    </div>
  );
}

export default MoltenRingCarouselDemo;
