'use client';

import type {ReactNode} from 'react';
import {Button, type ButtonVariant} from '@me-palnadu/ui';

/**
 * A submit button that asks before performing a destructive action.
 *
 * The confirmation is a convenience, not a control: the API still enforces the role
 * and validates the transition. `window.confirm` is used deliberately; a custom modal
 * would need focus management that the browser already implements here.
 */
export const ConfirmButton = ({
  message,
  variant = 'secondary',
  children,
}: {
  message: string;
  variant?: ButtonVariant;
  children: ReactNode;
}) => (
  <Button
    type="submit"
    variant={variant}
    onClick={(event) => {
      if (!window.confirm(message)) event.preventDefault();
    }}
  >
    {children}
  </Button>
);
