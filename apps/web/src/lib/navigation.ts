import {WEB_ROUTES} from '@me-palnadu/contracts';

/**
 * Navigation items for both the header navigation and the floating menu.
 *
 * Kept in a plain module so the two navigation components can consume the same
 * ordered list without importing each other. Navigation order is identical on
 * every route (WCAG 3.2.3) and in both navigation forms, so a visitor moving
 * between them finds the same items in the same places (UI_UX_STANDARDS 7.2).
 */
export const NAV_ITEMS = [
  {href: WEB_ROUTES.experience, label: 'Experience'},
  {href: WEB_ROUTES.projects, label: 'Projects'},
  {href: WEB_ROUTES.knowledgeHub, label: 'Knowledge Hub'},
  {href: WEB_ROUTES.resume, label: 'Resume'},
  {href: WEB_ROUTES.contact, label: 'Contact'},
] as const;
