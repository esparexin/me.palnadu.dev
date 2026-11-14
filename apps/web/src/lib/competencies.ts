'use client';

import type {ExperienceDetail} from '@/components/experience-detail-dialog';

/**
 * The two competency areas the career ring shows alongside the four roles.
 *
 * A competency is not an employment, so it has no employer, period, or
 * location. Its detail says what the practice covers and, by reference, the
 * roles it was practised in. The wording comes from the role details that
 * already exist in `experience.ts`; nothing here asserts an engagement, an
 * employer, or a figure that the rest of the site does not already claim.
 */
export interface CompetencyItem {
  id: string;
  title: string;
  detail: ExperienceDetail;
}

export const COMPETENCY_ITEMS: CompetencyItem[] = [
  {
    id: 'apple-device-management',
    title: 'Apple Device Management',
    detail: {
      company: 'Apple Device Management',
      role: 'Core competency',
      period: '',
      location: '',
      sections: [
        {
          title: 'What the practice covers',
          items: [
            'Automated device enrollment through Apple Business Manager, with PreStage enrollment for Zero Touch Deployment.',
            'Jamf Pro configuration profiles, policies, and self-service distribution as the only supported change path.',
            'CIS benchmark enforcement and FileVault disk encryption with institutional recovery keys.',
          ],
        },
        {
          title: 'Where it was practised',
          items: [
            'Zazz IT Solutions Private Limited — Apple Fleet Administration.',
            'United States Pharmacopeia (USP) — Jamf & macOS L1/L2 Support.',
          ],
        },
      ],
      technologies: [
        'Jamf Pro',
        'Apple Business Manager',
        'ADE/DEP',
        'PreStage',
        'CIS Benchmarks',
        'FileVault',
      ],
    },
  },
  {
    id: 'endpoint-security-operations',
    title: 'Endpoint Security Operations',
    detail: {
      company: 'Endpoint Security Operations',
      role: 'Core competency',
      period: '',
      location: '',
      sections: [
        {
          title: 'What the practice covers',
          items: [
            'CIS benchmark hardening, with remediation by script and a drift report grouped by benchmark line.',
            'Vulnerability assessment and penetration testing against the OWASP Top 10, from reconnaissance to validation.',
            'Security alert triage in a SIEM, and detection engineering from assessment findings.',
            'Compliance auditing evidence collection for ISO 27001 controls.',
          ],
        },
        {
          title: 'Where it was practised',
          items: [
            'eSF Labs Limited — Vulnerability Assessment & Penetration Testing.',
            'Zazz IT Solutions Private Limited — Compliance & Operations.',
          ],
        },
      ],
      technologies: [
        'CIS Benchmarks',
        'FileVault',
        'Burp Suite',
        'OWASP Top 10',
        'QRadar SIEM',
        'ISO 27001',
      ],
    },
  },
] as const;

export const COMPETENCY_BY_ID: ReadonlyMap<string, CompetencyItem> = new Map(
  COMPETENCY_ITEMS.map((item) => [item.id, item]),
);
