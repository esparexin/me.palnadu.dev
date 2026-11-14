import Link from 'next/link';
import {FloatingMenu} from './floating-menu';
import {LimelightNav} from './ui/limelight-nav';

/**
 * Header navigation.
 *
 * The desktop limelight nav is hidden below lg, where the floating menu takes
 * over; both menus render the same items in the same order
 * (UI_UX_STANDARDS 7.2).
 */
export const Navigation = () => (
  <>
    <header className="sticky top-0 z-sticky-header border-b border-border-subtle bg-surface">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-page items-center justify-between px-5 py-4 md:px-8"
      >
        <Link href="/" className="text-body font-semibold">
          Kalyan V Medaboina
        </Link>
        <LimelightNav />
      </nav>
    </header>
    <FloatingMenu />
  </>
);
