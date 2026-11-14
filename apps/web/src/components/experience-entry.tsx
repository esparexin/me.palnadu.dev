'use client';

import Image from 'next/image';
import {ChevronRight} from 'lucide-react';
import {cn} from '@me-palnadu/ui';
import type {ExperienceItem} from '@/lib/experience';

interface ExperienceEntryProps {
  item: ExperienceItem;
  isOpen: boolean;
  onOpen: (trigger: HTMLElement) => void;
}

/**
 * One role in the career list.
 *
 * The whole row is the control: it is a button that opens the detail dialog,
 * so it carries the border, the hover state, and the focus ring that say so.
 * There is no separate link inside it, because a link inside a button is not
 * a thing a keyboard or a screen reader can act on.
 */
export function ExperienceEntry({item, isOpen, onOpen}: ExperienceEntryProps) {
  return (
    <article className="py-4 first:pt-0" role="listitem">
      <button
        type="button"
        onClick={(e) => {
          e.currentTarget.focus();
          onOpen(e.currentTarget);
        }}
        className={cn(
          'group flex w-full flex-col items-start gap-4 rounded-xl border border-border-subtle bg-surface p-5 text-left transition-colors duration-fast ease-standard',
          'hover:border-border-default hover:bg-surface-subtle',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          'lg:flex-row lg:items-center lg:justify-between',
          isOpen && 'border-accent bg-surface-subtle',
        )}
        aria-haspopup="dialog"
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-controls={`${item.id}-detail`}
      >
        <div className="flex w-full min-w-0 flex-1 items-start gap-4 lg:items-center">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-surface-subtle lg:h-16 lg:w-16"
            aria-hidden="true"
          >
            <Image
              src={item.logo}
              alt={item.logoAlt}
              width={56}
              height={56}
              className="object-contain p-2"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden h-full w-full items-center justify-center text-accent">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 17" />
              </svg>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-h3 font-semibold text-text-primary">{item.company}</h3>
            <p className="mt-1 flex flex-wrap gap-3 text-body-sm text-text-secondary">
              <span>{item.period}</span>
              <span aria-hidden="true">·</span>
              <span>{item.location}</span>
            </p>
            <p className="mt-1 text-body text-text-primary">{item.role}</p>
          </div>
        </div>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-accent transition-transform duration-fast group-hover:translate-x-1"
          aria-hidden="true"
        />
      </button>
    </article>
  );
}

export default ExperienceEntry;
