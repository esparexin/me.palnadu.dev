import Link from 'next/link';

/**
 * Header navigation.
 *
 * Navigation order is identical on every route (WCAG 3.2.3) and matches the
 * floating menu exactly, so a visitor moving between the two finds the same
 * items in the same places (UI_UX_STANDARDS 7.2).
 */
export const NAV_ITEMS = [
  { href: '/experience', label: 'Experience' },
  { href: '/projects', label: 'Projects' },
  { href: '/knowledge', label: 'Knowledge Hub' },
  { href: '/resume', label: 'Resume' },
  { href: '/contact', label: 'Contact' },
] as const;

export const Navigation = () => (
  <header className="sticky top-0 z-sticky-header border-b border-border-subtle bg-surface">
    <nav aria-label="Primary" className="mx-auto flex max-w-page items-center justify-between px-5 py-4 md:px-8">
      <Link href="/" className="text-body font-semibold">
        me.palnadu.dev
      </Link>
      {/* Hidden below lg, where the floating menu takes over (UI_UX_STANDARDS 7.2). */}
      <ul className="hidden items-center gap-6 lg:flex">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="text-body-sm text-text-secondary hover:text-text-primary">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  </header>
);