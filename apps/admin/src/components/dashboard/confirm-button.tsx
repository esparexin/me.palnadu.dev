'use client';

import {useState, type ReactNode} from 'react';
import {Button, Dialog, type ButtonVariant} from '@me-palnadu/ui';

/**
 * A submit button that asks before performing a destructive action.
 *
 * The confirmation is a convenience, not a control: the API still enforces the role
 * and validates the transition. It uses the shared `Dialog` primitive rather than
 * `window.confirm`, which CODING_STANDARDS.md section 7 bans because the browser
 * dialog cannot carry tokens, cannot be styled, and is not part of the design system.
 */
export const ConfirmButton = ({
  message,
  variant = 'secondary',
  children,
}: {
  message: string;
  variant?: ButtonVariant;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant={variant} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={message}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={variant}>
              {children}
            </Button>
          </>
        }
      />
    </>
  );
};
