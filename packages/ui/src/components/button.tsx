import type {AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode} from 'react';
import {cn} from '../lib/cn.js';

/**
 * The only button implementation in the repository (UI_UX_STANDARDS 4).
 * A visual variant, a size, and nothing else: every colour comes from a token.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-text-inverse hover:bg-accent-hover',
  secondary: 'border border-border-default text-text-primary hover:bg-surface-subtle',
  tertiary: 'text-accent hover:text-accent-hover',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-3 text-body-sm',
  md: 'min-h-10 px-4 text-body-sm',
  lg: 'min-h-12 px-6 text-body',
};

const BASE_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium ' +
  'transition-colors duration-fast ease-standard ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:pointer-events-none disabled:opacity-60';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) => (
  <button
    type={type}
    className={cn(BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
    {...rest}
  >
    {children}
  </button>
);

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

/** A link that looks like a button and is still a link: correct semantics, navigable. */
export const ButtonLink = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonLinkProps) => (
  <a className={cn(BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], className)} {...rest}>
    {children}
  </a>
);
