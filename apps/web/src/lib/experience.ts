'use client';

import type {ExperienceDetail} from '@/components/experience-detail-dialog';

export interface ExperienceItem {
  id: string;
  company: string;
  role: string;
  period: string;
  location: string;
  logo: string;
  logoAlt: string;
  detail: ExperienceDetail;
}

export const EXPERIENCE_ITEMS: ExperienceItem[] = [
  {
    id: 'zazz-it-solutions',
    company: 'Zazz IT Solutions Private Limited',
    role: 'System Administrator',
    period: 'August 2024 – February 2026',
    location: 'Hyderabad',
    logo: '/experience/zazz-it-solutions.svg',
    logoAlt: 'Zazz IT Solutions logo',
    detail: {
      company: 'Zazz IT Solutions Private Limited',
      role: 'System Administrator',
      period: 'August 2024 – February 2026',
      location: 'Hyderabad',
      sections: [
        {
          title: 'Apple Fleet Administration',
          items: [
            'Administered 100+ Mac fleet via Jamf Pro and Jamf Connect, covering enrollment, configuration profiles, policies, and patch management.',
            'Managed Apple Business Manager (ABM) and Automated Device Enrollment (ADE/DEP) with PreStage enrollments for Zero Touch Deployment.',
            'Orchestrated macOS application lifecycle: packaging, testing, versioning, and self-service distribution via Jamf Self Service.',
            'Enforced CIS Level 1 benchmarks, FileVault 2 encryption with institutional recovery keys, and Sophos Endpoint Protection across the fleet.',
          ],
        },
        {
          title: 'Microsoft 365 & Identity',
          items: [
            'Administered Microsoft 365 tenant: Exchange Online, SharePoint, Teams, and Entra ID (Azure AD) with Conditional Access and MFA policies.',
            'Managed Intune co-management for Windows and macOS, including compliance policies, configuration profiles, and app deployment.',
            'Implemented Entra ID Identity Protection, Privileged Identity Management, and Conditional Access for Zero Trust posture.',
          ],
        },
        {
          title: 'Compliance & Operations',
          items: [
            'Maintained ISO 27001:2022 controls: asset inventory, access reviews, incident response, and internal audit evidence collection.',
            'Automated onboarding/offboarding workflows with Bash scripts integrating Jamf API, Microsoft Graph, and Zoho Creator.',
            'Built and maintained Zoho Creator asset management application tracking 200+ devices, licenses, and warranty lifecycles.',
            'Achieved 98% patch compliance within SLA and 99.5% endpoint security score across the managed fleet.',
          ],
        },
      ],
      technologies: [
        'Jamf Pro',
        'Jamf Connect',
        'Apple Business Manager',
        'ADE/DEP',
        'Zero Touch Deployment',
        'CIS Benchmarks',
        'FileVault',
        'Sophos Endpoint',
        'Microsoft 365',
        'Intune',
        'Entra ID',
        'ISO 27001',
        'Bash',
        'Zoho Creator',
      ],
    },
  },
  {
    id: 'esf-labs',
    company: 'eSF Labs Limited',
    role: 'Security Analyst L1',
    period: 'February 2022 – October 2023',
    location: 'Vijayawada',
    logo: '/experience/esf-labs.svg',
    logoAlt: 'eSF Labs logo',
    detail: {
      company: 'eSF Labs Limited',
      role: 'Security Analyst L1',
      period: 'February 2022 – October 2023',
      location: 'Vijayawada',
      sections: [
        {
          title: 'Vulnerability Assessment & Penetration Testing',
          items: [
            'Conducted 50+ VAPT engagements across web applications, networks, and APIs for clients in finance, healthcare, and SaaS sectors.',
            'Performed network reconnaissance, service enumeration, and vulnerability scanning using Nmap, Masscan, and OpenVAS.',
            'Executed web application security assessments aligned with OWASP Top 10, leveraging Burp Suite Professional and OWASP ZAP.',
            'Analyzed network traffic with Wireshark for anomaly detection and protocol-level vulnerability validation.',
          ],
        },
        {
          title: 'Security Operations & Incident Response',
          items: [
            'Triage and investigation of security alerts from QRadar SIEM, correlating logs across firewalls, endpoints, and cloud sources.',
            'Participated in red-team exercises as blue-team defender: detection rule tuning, log enrichment, and attack path analysis.',
            'Designed and executed phishing simulation campaigns, measuring click rates, credential submission, and reporting velocity.',
          ],
        },
      ],
      technologies: [
        'Burp Suite',
        'OWASP ZAP',
        'Wireshark',
        'QRadar SIEM',
        'Nmap',
        'Masscan',
        'OpenVAS',
        'Red Teaming',
        'Phishing Simulation',
        'OWASP Top 10',
      ],
    },
  },
  {
    id: 'usp',
    company: 'United States Pharmacopeia (USP)',
    role: 'Helpdesk Engineer L2',
    period: 'July 2018 – September 2021',
    location: 'Hyderabad',
    logo: '/experience/usp.svg',
    logoAlt: 'United States Pharmacopeia logo',
    detail: {
      company: 'United States Pharmacopeia (USP)',
      role: 'Helpdesk Engineer L2',
      period: 'July 2018 – September 2021',
      location: 'Hyderabad',
      sections: [
        {
          title: 'Jamf & macOS L1/L2 Support',
          items: [
            'Provided L1/L2 support for 500+ macOS endpoints managed via Jamf Pro, resolving enrollment, policy, and Self Service issues.',
            'Troubleshot ADE/DEP and PreStage enrollment failures, including certificate, network, and MDM profile diagnostics.',
            'Managed macOS upgrade lifecycle: testing, deferral policies, and phased rollouts via Jamf policies and Nudge.',
          ],
        },
        {
          title: 'Identity, Access & Infrastructure',
          items: [
            'Administered Active Directory: user/group management, GPO deployment, OU design, and password/lockout policies.',
            'Supported VDI (VMware Horizon), RDP, and VPN (Pulse Secure/Cisco AnyConnect) access for 300+ remote users.',
            'Managed Veritas NetBackup policies for endpoint and server backup, including restore testing and DR drills.',
          ],
        },
        {
          title: 'IT Asset Management & Projects',
          items: [
            'Maintained IT asset inventory across hardware, software licenses, and SaaS subscriptions in ServiceNow CMDB.',
            'Contributed to infrastructure upgrade projects: Jamf Pro cloud migration, AD forest consolidation, and VPN modernization.',
          ],
        },
      ],
      technologies: [
        'Jamf Pro',
        'macOS',
        'ADE/DEP',
        'PreStage',
        'Active Directory',
        'GPO',
        'VMware Horizon',
        'VDI',
        'RDP',
        'VPN',
        'NetBackup',
        'ServiceNow',
        'ITAM',
      ],
    },
  },
  {
    id: 'brandpier',
    company: 'BrandPier Software Pvt. Ltd.',
    role: 'System Administrator',
    period: 'July 2016 – June 2018',
    location: 'Hyderabad',
    logo: '/experience/brandpier.svg',
    logoAlt: 'BrandPier Software logo',
    detail: {
      company: 'BrandPier Software Pvt. Ltd.',
      role: 'System Administrator',
      period: 'July 2016 – June 2018',
      location: 'Hyderabad',
      sections: [
        {
          title: 'Server & Network Infrastructure',
          items: [
            'Administered Windows Server 2012 R2 / 2016: AD DS, DNS, DHCP, File and Print Services, WSUS, and DFS-R.',
            'Managed domain controllers, group policies, trust relationships, and schema extensions for application integration.',
            'Configured and maintained site-to-site and client VPN (RRAS/SSTP) for secure remote access across 2 offices.',
          ],
        },
        {
          title: 'Data Protection & Business Continuity',
          items: [
            'Designed and operated backup strategy using Veeam Backup & Replication: daily incrementals, weekly synthetics, monthly offsite.',
            'Executed quarterly disaster recovery tests, achieving RPO < 4 hours and RTO < 8 hours for critical workloads.',
            'Reduced unplanned downtime by 40% through proactive monitoring (PRTG), patch automation, and capacity planning.',
          ],
        },
      ],
      technologies: [
        'Windows Server',
        'Active Directory',
        'DNS',
        'DHCP',
        'File Services',
        'Print Services',
        'WSUS',
        'DFS-R',
        'Veeam',
        'Disaster Recovery',
        'VPN',
        'PRTG',
      ],
    },
  },
] as const;
