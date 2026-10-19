import Link from 'next/link';
import {WEB_ROUTES} from '@me-palnadu/contracts';

/**
 * Header navigation.
 *
 * Navigation order is identical on every route (WCAG 3.2.3) and matches the
 * floating menu exactly, so a visitor moving between the two finds the same
 * items in the same places (UI_UX_STANDARDS 7.2).
 */
export const NAV_ITEMS = [
  {href: WEB_ROUTES.experience, label: 'Experience'},
  {href: WEB_ROUTES.projects, label: 'Projects'},
  {href: WEB_ROUTES.knowledgeHub, label: 'Knowledge Hub'},
  {href: WEB_ROUTES.faq, label: 'FAQ'},
  {href: WEB_ROUTES.resume, label: 'Resume'},
  {href: WEB_ROUTES.contact, label: 'Contact'},
] as const;

export const Navigation = () => (
  <header className="sticky top-0 z-sticky-header border-b border-border-subtle bg-surface">
    <nav
      aria-label="Primary"
      className="mx-auto flex max-w-page items-center justify-between px-5 py-4 md:px-8"
    >
      <Link href="/" className="text-body font-semibold">
        me.palnadu.dev
      </Link>
      {/* Hidden below lg, where the floating menu takes over (UI_UX_STANDARDS 7.2). */}
      <ul className="hidden items-center gap-6 lg:flex">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="text-body-sm text-text-secondary hover:text-text-primary"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  </header>
);
