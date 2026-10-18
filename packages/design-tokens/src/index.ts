/**
 * Runtime mirror of the tokens in `theme.css`.
 *
 * Two representations are necessary: CSS custom properties for styling, and
 * plain values for logic that cannot read CSS (for example writing a design value
 * into a canvas, or asserting a token exists). They must never diverge, so
 * `theme.test.ts` compares the key sets of both representations.
 *
 * This package imports nothing (ARCHITECTURE.md section 4).
 */

export const COLOR_TOKENS = {
  surface: '#ffffff',
  'surface-subtle': '#f5f5f7',
  'surface-muted': '#e8e8ed',
  'text-primary': '#1d1d1f',
  'text-secondary': '#424245',
  'text-tertiary': '#6e6e73',
  'text-inverse': '#ffffff',
  accent: '#0071e3',
  'accent-hover': '#0077ed',
  'accent-subtle': '#e8f2fe',
  'accent-text': '#005cb4',
  'border-default': '#d2d2d7',
  'border-subtle': '#e8e8ed',
  focus: '#0071e3',
  success: '#1d8a4e',
  warning: '#b25000',
  danger: '#c8102e',
  info: '#0b6bcb',
} as const;

export type ColorToken = keyof typeof COLOR_TOKENS;

/**
 * Upper bounds. The CSS theme clamps between a floor and these values, so a
 * runtime consumer that cannot read CSS should treat `size` as the maximum, not
 * as the rendered size (UI_UX_STANDARDS 3).
 */
export const TYPOGRAPHY_TOKENS = {
  eyebrow: { size: '0.75rem', lineHeight: '1rem', letterSpacing: '0.08em' },
  meta: { size: '0.8125rem', lineHeight: '1.125rem', letterSpacing: '0.01em' },
  'body-sm': { size: '0.9375rem', lineHeight: '1.4375rem' },
  body: { size: '1.0625rem', lineHeight: '1.6875rem' },
  lead: { size: '1.3125rem', lineHeight: '1.875rem', letterSpacing: '-0.01em' },
  h3: { size: '1.3125rem', lineHeight: '1.75rem', letterSpacing: '-0.01em' },
  h2: { size: '1.75rem', lineHeight: '2.125rem', letterSpacing: '-0.015em' },
  h1: { size: '2.5rem', lineHeight: '2.875rem', letterSpacing: '-0.02em' },
  display: { size: '3.5rem', lineHeight: '3.75rem', letterSpacing: '-0.02em' },
} as const;

export type TypographyToken = keyof typeof TYPOGRAPHY_TOKENS;

export const SPACING_SCALE = [
  'px', '0', '1', '2', '3', '4', '5', '6', '8', '10', '12', '16', '20', '24', '32',
] as const;

export const RADIUS_TOKENS = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  pill: '999px',
} as const;

export const SHADOW_TOKENS = {
  sm: '0 1px 2px rgb(0 0 0 / 0.04)',
  md: '0 8px 30px rgb(0 0 0 / 0.07)',
  lg: '0 20px 60px rgb(0 0 0 / 0.1)',
} as const;

export const MOTION_TOKENS = {
  'duration-fast': '120ms',
  'duration-base': '200ms',
  'duration-slow': '320ms',
  'ease-out': 'cubic-bezier(0.32, 0.72, 0, 1)',
  'ease-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
  'ease-standard': 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const BREAKPOINTS = {
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
} as const;

/** Mobile-first: the floating menu exists below `lg`, desktop nav at `lg` and up. */
export const FLOATING_MENU_BREAKPOINT = BREAKPOINTS.lg;

export const Z_INDEX_TOKENS = {
  base: 0,
  'sticky-header': 100,
  fab: 200,
  'fab-panel': 210,
  dialog: 300,
  toast: 400,
} as const;

export const LAYOUT_TOKENS = {
  measure: '720px',
  page: '1120px',
  gutterMobile: '20px',
  gutterDesktop: '32px',
} as const;

export const FONT_SANS =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const designTokens = {
  color: COLOR_TOKENS,
  typography: TYPOGRAPHY_TOKENS,
  spacing: SPACING_SCALE,
  radius: RADIUS_TOKENS,
  shadow: SHADOW_TOKENS,
  motion: MOTION_TOKENS,
  breakpoints: BREAKPOINTS,
  zIndex: Z_INDEX_TOKENS,
  layout: LAYOUT_TOKENS,
  fontSans: FONT_SANS,
} as const;