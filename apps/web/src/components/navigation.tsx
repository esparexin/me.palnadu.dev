import Link from 'next/link';
import {FloatingMenu} from './floating-menu';
import {NAV_ITEMS} from '../lib/navigation';

/**
 * Header navigation.
 *
 * The list is hidden below lg, where the floating menu takes over; both menus
 * render the same items in the same order (UI_UX_STANDARDS 7.2).
 */
export const Navigation = () => (
  <>
    <header className="sticky top-0 z-sticky-header border-b border-border-subtle bg-surface">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-page items-center justify-between px-5 py-4 md:px-8"
      >
        <Link href="/" className="text-body font-semibold">
          me.palnadu.dev
        </Link>
        <ul className="hidden items-center gap-6 lg:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-flex min-h-6 items-center text-body-sm text-text-secondary hover:text-text-primary"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
    <FloatingMenu />
  </>
);
