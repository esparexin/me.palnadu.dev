import type {ReactNode} from 'react';
import {cn} from '../lib/cn.js';

/**
 * Status and category labels (UI_UX_STANDARDS §2.1).
 *
 * Colour is never the only signal: the label text carries the meaning, and the
 * tint is reinforcement. Every class is a token; there are no raw palette values.
 */
export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-text-secondary',
  accent: 'bg-accent-subtle text-accent-text',
  success: 'bg-surface-muted text-success',
  warning: 'bg-surface-muted text-warning',
  danger: 'bg-surface-muted text-danger',
  info: 'bg-surface-muted text-info',
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export const Badge = ({tone = 'neutral', children, className}: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center rounded-pill px-2.5 py-0.5 text-meta font-medium',
      TONE_CLASS[tone],
      className,
    )}
  >
    {children}
  </span>
);
