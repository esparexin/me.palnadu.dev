'use client';

import {useEffect, useId, useRef} from 'react';
import {cn} from '@me-palnadu/ui';

/**
 * Accessible modal dialog / bottom sheet for experience details.
 *
 * - Desktop (lg+): centered modal dialog
 * - Mobile (< lg): bottom-up sheet occupying most of viewport height
 * - Supports Escape, focus trap, focus restoration, and scroll lock
 */
export interface ExperienceDetail {
  company: string;
  role: string;
  period: string;
  location: string;
  sections: Array<{title: string; items: string[]}>;
  technologies: string[];
}

interface ExperienceDetailDialogProps {
  open: boolean;
  onClose: () => void;
  detail: ExperienceDetail;
  id?: string | undefined;
  opener?: HTMLElement | null | undefined;
}

export function ExperienceDetailDialog({
  open,
  onClose,
  detail,
  id,
  opener,
}: ExperienceDetailDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const scrollYRef = useRef(0);

  useEffect(() => {
    onCloseRef.current = onClose;
    if (opener) openerRef.current = opener;
  });

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    if (opener) {
      openerRef.current = opener;
    } else if (!openerRef.current && document.activeElement instanceof HTMLElement) {
      openerRef.current = document.activeElement;
    }

    // Lock body scroll on mobile
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      scrollYRef.current = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollYRef.current}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    }

    const focusableItems = (): HTMLElement[] => [
      ...panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];

    // Focus first focusable element or the panel
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
      // Restore scroll position on mobile
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollYRef.current);
      }
      openerRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  return (
    <div
      className={cn(
        'fixed inset-0 z-dialog flex',
        isMobile ? 'items-end justify-center' : 'items-center justify-center',
      )}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-text-primary/50 transition-opacity duration-fast"
        onClick={(e) => e.stopPropagation()}
      />
      <div
        id={id}
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative w-full max-w-2xl rounded-t-2xl border border-border-subtle bg-surface shadow-lg transition-transform duration-fast',
          isMobile
            ? 'max-h-[85vh] transform translate-y-0'
            : 'max-h-[85vh] rounded-t-2xl rounded-b-2xl',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle for mobile */}
        {isMobile && (
          <div className="flex justify-center pt-3 pb-2" aria-hidden="true">
            <div className="h-1 w-10 rounded-full bg-border-default" />
          </div>
        )}

        <div className={cn('p-6', isMobile ? 'pb-8' : 'pr-8')}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p id={titleId} className="text-h3 font-semibold text-text-primary truncate">
                {detail.company}
              </p>
              <p className="mt-1 text-body-sm text-text-secondary">{detail.role}</p>
              <p className="mt-0.5 text-meta text-text-tertiary flex flex-wrap gap-3">
                <span>{detail.period}</span>
                <span>·</span>
                <span>{detail.location}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus transition-colors"
              aria-label="Close experience details"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div
            id={descriptionId}
            className="mt-6 max-h-[60vh] overflow-y-auto pr-2"
            role="region"
            aria-label="Experience details"
            tabIndex={0}
          >
            {detail.sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="space-y-4">
                <h3 className="text-body font-medium text-text-primary">{section.title}</h3>
                <ul className="space-y-3 pl-5 list-disc">
                  {section.items.map((item, itemIndex) => (
                    <li
                      key={itemIndex}
                      className="text-body-sm text-text-secondary leading-relaxed"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {detail.technologies.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border-subtle">
                <h3 className="text-body font-medium text-text-primary mb-3">Technologies</h3>
                <div className="flex flex-wrap gap-2">
                  {detail.technologies.map((tech, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-pill text-xs font-medium bg-accent-subtle text-accent-text"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExperienceDetailDialog;
