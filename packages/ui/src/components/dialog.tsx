'use client';

import {useEffect, useId, useRef, type ReactNode} from 'react';
import {cn} from '../lib/cn.js';

/**
 * Accessible modal dialog (UI_UX_STANDARDS section 4).
 *
 * Requirements implemented here, and why each is not left to the browser:
 * - `role="dialog"` + `aria-modal="true"` + a labelled title, so the panel is
 *   announced as a dialog rather than an anonymous region.
 * - Focus moves into the dialog on open and is trapped on `Tab`/`Shift+Tab`; a
 *   keyboard user cannot reach the inert page behind it.
 * - `Escape` closes.
 * - Focus returns to whatever was focused before opening, on every close path.
 *
 * The close handler is held in a ref so the effect depends only on `open`: a
 * caller passing an inline arrow would otherwise re-register the listeners on
 * every render and steal focus back to the first control mid-interaction.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name and visible heading. */
  title: string;
  description?: string;
  /** Footer actions, rendered right-aligned after the body. */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export const Dialog = ({
  open,
  onClose,
  title,
  description,
  actions,
  children,
  className,
}: DialogProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (panel === null) return;

    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusableItems = (): HTMLElement[] => [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
    (focusableItems()[0] ?? panel).focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusableItems();
      const first = items[0];
      const last = items[items.length - 1];
      if (first === undefined || last === undefined) {
        event.preventDefault();
        panel.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openerRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-dialog flex items-center justify-center p-5">
      <div aria-hidden="true" className="absolute inset-0 bg-text-primary/50" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...(description === undefined ? {} : {'aria-describedby': descriptionId})}
        tabIndex={-1}
        className={cn(
          'relative w-full max-w-md rounded-lg border border-border-subtle bg-surface p-6 shadow-lg',
          className,
        )}
      >
        <h2 id={titleId} className="text-h3 font-semibold text-text-primary">
          {title}
        </h2>
        {description !== undefined && (
          <p id={descriptionId} className="mt-2 text-body-sm text-text-secondary">
            {description}
          </p>
        )}
        {children}
        {actions !== undefined && (
          <div className="mt-6 flex flex-wrap justify-end gap-3">{actions}</div>
        )}
      </div>
    </div>
  );
};
