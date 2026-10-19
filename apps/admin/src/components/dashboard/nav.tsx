'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {Role} from '@me-palnadu/contracts';
import {cn} from '@me-palnadu/ui';

interface NavItem {
  href: string;
  label: string;
  ownerOnly?: boolean;
}

const ITEMS: readonly NavItem[] = [
  {href: '/dashboard', label: 'Overview'},
  {href: '/dashboard/knowledge', label: 'Knowledge Hub'},
  {href: '/dashboard/faq', label: 'FAQ'},
  {href: '/dashboard/media', label: 'Media'},
  {href: '/dashboard/audit', label: 'Audit', ownerOnly: true},
  {href: '/dashboard/security', label: 'Security'},
];

/**
 * Dashboard navigation.
 *
 * `aria-current` marks the active destination for assistive technology; the tint is
 * only reinforcement. An owner-only item is hidden for an editor, and the API still
 * refuses the route if the URL is typed: hiding is not access control.
 */
export const DashboardNav = ({role}: {role: Role}) => {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.filter((item) => item.ownerOnly !== true || role === 'owner').map((item) => {
        const active =
          item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-2 text-body-sm font-medium transition-colors duration-fast',
              active
                ? 'bg-accent-subtle text-accent-text'
                : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
};
