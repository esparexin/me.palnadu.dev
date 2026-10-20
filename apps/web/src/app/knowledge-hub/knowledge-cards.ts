import {ARTICLE_KIND_LABELS, type PublicArticleSummary} from '@me-palnadu/contracts';
import type {FloatingGalleryCard} from '../../components/ui/floating-card-gallery';

export const DEFAULT_KNOWLEDGE_CARDS: FloatingGalleryCard[] = [
  {
    id: 'jamf-pro-mac-fleet',
    slug: 'jamf-pro-mac-fleet-management',
    title: 'Enterprise Mac Fleet Management with Jamf Pro',
    description:
      'Architecture patterns for managing 100+ macOS devices with PreStage enrollment, configuration profiles, and patch compliance.',
    fullDescription:
      'Comprehensive guide covering automated PreStage enrollment via Apple Business Manager, scoping configuration profiles, packaging PKGs with Composer, and achieving 98%+ security compliance across distributed fleets.',
    category: 'Apple MDM',
    kind: 'tutorial',
    difficulty: 'advanced',
    readingTimeMinutes: 12,
    image: '/competencies/jamf-mdm.svg',
    author: 'Kalyan V Medaboina',
    tags: ['Jamf Pro', 'macOS', 'PreStage', 'MDM'],
  },
  {
    id: 'intune-conditional-access',
    slug: 'microsoft-intune-conditional-access',
    title: 'Zero Trust & Conditional Access in Microsoft Intune',
    description:
      'Enforcing device compliance, Entra ID hybrid join, and continuous risk assessment across Windows and mobile endpoints.',
    fullDescription:
      'Deep dive into implementing Zero Trust architectures: configuring device compliance policies, Entra ID Conditional Access, BitLocker escrowing, and integrating Microsoft Defender for Endpoint.',
    category: 'Microsoft Intune',
    kind: 'kt_guide',
    difficulty: 'advanced',
    readingTimeMinutes: 15,
    image: '/competencies/intune-cloud.svg',
    author: 'Kalyan V Medaboina',
    tags: ['Intune', 'Entra ID', 'Zero Trust', 'Compliance'],
  },
  {
    id: 'zero-touch-deployment',
    slug: 'zero-touch-deployment-apple-windows',
    title: 'Zero Touch Deployment: Apple ABM to Windows Autopilot',
    description:
      'Seamless out-of-the-box provisioning strategies eliminating manual imaging and IT desk touchpoints.',
    fullDescription:
      'Step-by-step blueprint for setting up drop-ship hardware workflows using Apple Business Manager (ADE/DEP) and Windows Autopilot, ensuring secure cryptographic identity bootstrap on first boot.',
    category: 'Deployment',
    kind: 'tutorial',
    difficulty: 'intermediate',
    readingTimeMinutes: 10,
    image: '/competencies/zero-touch.svg',
    author: 'Kalyan V Medaboina',
    tags: ['ABM', 'Autopilot', 'ADE', 'Automation'],
  },
  {
    id: 'cis-benchmark-hardening',
    slug: 'cis-benchmarks-endpoint-hardening',
    title: 'CIS Benchmark Hardening for macOS and Windows 11',
    description:
      'Hardening enterprise operating systems to CIS Level 1 & 2 standards with automated remediation scripts.',
    fullDescription:
      'Practical guide to auditing and remediating system vulnerabilities: FileVault encryption, SIP enforcement, audit logging, firewall policies, and maintaining a 99.5% compliance posture.',
    category: 'Cybersecurity',
    kind: 'troubleshooting',
    difficulty: 'advanced',
    readingTimeMinutes: 14,
    image: '/competencies/endpoint-security.svg',
    author: 'Kalyan V Medaboina',
    tags: ['CIS', 'Hardening', 'FileVault', 'Security'],
  },
  {
    id: 'iso-27001-compliance',
    slug: 'iso-27001-endpoint-controls',
    title: 'ISO 27001 IT Controls & Fleet Audit Readiness',
    description:
      'Translating ISO 27001 Annex A controls into enforceable technical policies and audit trails.',
    fullDescription:
      'Framework for designing tamper-evident change management, asset management lifecycles, and risk registers that sail through SOC 2 and ISO 27001 certification audits.',
    category: 'Governance',
    kind: 'kt_guide',
    difficulty: 'intermediate',
    readingTimeMinutes: 8,
    image: '/competencies/iso-governance.svg',
    author: 'Kalyan V Medaboina',
    tags: ['ISO 27001', 'Audit', 'Governance', 'SOC 2'],
  },
  {
    id: 'vapt-threat-defense',
    slug: 'vapt-and-siem-integration',
    title: 'VAPT Remediation & Enterprise SIEM Threat Defense',
    description:
      'Integrating endpoint event streams with QRadar SIEM and conducting vulnerability assessments.',
    fullDescription:
      'Real-world lessons from 50+ enterprise VAPT engagements: threat hunting, credential dumping mitigations, rapid CVE triage, and log pipeline engineering for security operations.',
    category: 'Threat Defense',
    kind: 'interview',
    difficulty: 'advanced',
    readingTimeMinutes: 11,
    image: '/competencies/cyber-vapt.svg',
    author: 'Kalyan V Medaboina',
    tags: ['VAPT', 'QRadar', 'SIEM', 'Threat Defense'],
  },
];

const SVG_BY_TAG: Record<string, string> = {
  jamf: '/competencies/jamf-mdm.svg',
  intune: '/competencies/intune-cloud.svg',
  autopilot: '/competencies/zero-touch.svg',
  cis: '/competencies/endpoint-security.svg',
  security: '/competencies/endpoint-security.svg',
  iso: '/competencies/iso-governance.svg',
  vapt: '/competencies/cyber-vapt.svg',
};

export const mapArticlesToGalleryCards = (
  articles: PublicArticleSummary[],
): FloatingGalleryCard[] => {
  return articles.map((article) => {
    const matchingTag = article.tags.find((tag) => SVG_BY_TAG[tag.toLowerCase()]);
    const image = matchingTag
      ? SVG_BY_TAG[matchingTag.toLowerCase()]
      : '/competencies/jamf-mdm.svg';

    return {
      id: article.id,
      slug: article.slug,
      title: article.title,
      description: article.excerpt,
      category: ARTICLE_KIND_LABELS[article.kind] ?? article.kind,
      kind: article.kind,
      difficulty: article.difficulty,
      publishedAt: article.publishedAt,
      tags: article.tags,
      author: 'Kalyan V Medaboina',
      image,
    };
  });
};
