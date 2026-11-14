'use client';

import * as React from 'react';
import {ChevronLeft, ChevronRight, BookOpen} from 'lucide-react';
import {IconButton, cn} from '@me-palnadu/ui';
import {TRIGGER_CLEARANCE} from '../../lib/floating-trigger';
import {FUSE} from './molten-ring/constants';
import type {MoltenRingCarouselProps, MoltenRingItem} from './molten-ring/types';
import {useMoltenRing} from './molten-ring/use-molten-ring';

export type {MoltenRingItem, MoltenRingCarouselProps};

export function MoltenRingCarousel({
  items,
  brand,
  onCardOpen,
  arc = 1,
  cardSize = 0.265,
  cardRatio = 1.5,
  fuse = FUSE,
  threads = true,
  glass = true,
  className,
  ...props
}: MoltenRingCarouselProps) {
  const {canvasRef, active, step, supported, count} = useMoltenRing(items, {
    arc,
    cardSize,
    cardRatio,
    fuse,
    threads,
    glass,
    onCardClick: (index) => onCardOpen?.(index),
  });

  const item = items[active];

  // The visible wordmark is optional; the accessible name is not. A caller
  // that drops the wordmark supplies its own name, because the fallback would
  // name the wrong thing.
  const accessibleName = props['aria-label'] ?? brand ?? 'Core Competencies';

  if (!supported) {
    return (
      <section
        aria-roledescription="carousel"
        aria-label={accessibleName}
        className={cn(
          'relative h-full min-h-[24rem] w-full bg-surface text-text-primary',
          className,
        )}
        {...props}
      >
        <ul className="flex h-full snap-y snap-mandatory flex-col items-center gap-4 overflow-y-auto py-8">
          {items.map((entry) => (
            <li
              key={entry.title}
              className="w-[85%] max-w-md shrink-0 snap-center rounded-lg border border-border-subtle bg-surface p-4 shadow-sm"
            >
              <div className="text-display font-bold text-accent">{entry.title}</div>
              {entry.meta && (
                <div className="mt-1 text-body-sm text-text-secondary">{entry.meta}</div>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  /**
   * The ring is a pointer-driven control, so it needs a button equivalent for
   * anyone who cannot drag (WCAG 2.5.7) and a keyboard path into the same
   * state. Both live in the control row below the canvas.
   *
   * `step` moves the ring by a number of cards and wraps, so the distance to a
   * named card is the difference between the target and the active index,
   * taken modulo the number of cards.
   */
  const distanceTo = (target: number) =>
    count === 0 ? 0 : (((target - active) % count) + count) % count;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      step(distanceTo(0));
    } else if (event.key === 'End') {
      event.preventDefault();
      step(distanceTo(count - 1));
    }
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={accessibleName}
      className={cn(
        // flex-1 rather than h-full: the card that holds this section is
        // sized by the page layout, and a percentage height does not resolve
        // against a box whose height comes from the flex algorithm.
        'relative flex min-h-[26rem] w-full flex-1 flex-col select-none overflow-hidden bg-surface text-text-primary',
        className,
      )}
      {...props}
    >
      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full cursor-grab touch-pan-x text-text-primary outline-none active:cursor-grabbing"
        />

        {/* Assistive technology text representation */}
        <ul className="sr-only">
          {items.map((entry) => (
            <li key={entry.title}>
              {entry.title}
              {entry.meta ? `. ${entry.meta}` : ''}
            </li>
          ))}
        </ul>

        {brand ? (
          <div className="pointer-events-none absolute left-[5%] top-[6%] text-meta font-semibold uppercase tracking-widest text-accent-text">
            {brand}
          </div>
        ) : null}
      </div>

      {/*
        The readouts live in the control row rather than floating over the
        canvas. Two absolutely positioned blocks both anchored to the middle of
        the canvas collided at every width below `lg`, where the container is
        narrower than the text they carry.
      */}
      <div className="border-t border-border-subtle py-3 pl-4 pr-4">
        <div
          className={cn(
            // Below `sm` the controls sit under the readout: side by side they
            // leave the text a column too narrow to read.
            'flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between',
            TRIGGER_CLEARANCE,
          )}
          onKeyDown={onKeyDown}
        >
          <div className="min-w-0">
            <div className="text-meta font-medium tabular-nums text-text-tertiary">
              {String(active + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
            </div>
            <div className="mt-1 truncate text-h3 font-bold tracking-tight text-text-primary">
              {item?.title}
            </div>
            {item?.meta ? (
              <div className="mt-1 line-clamp-2 text-body-sm font-medium text-text-secondary">
                {item.meta}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
            <IconButton
              label="Previous entry"
              size="lg"
              onClick={() => {
                step(-1);
              }}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Next entry"
              size="lg"
              onClick={() => {
                step(1);
              }}
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </IconButton>
            {onCardOpen !== undefined ? (
              <IconButton
                label={`Open details for ${item?.title ?? 'the current entry'}`}
                size="lg"
                onClick={() => {
                  onCardOpen(active);
                }}
              >
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </IconButton>
            ) : null}
          </div>
        </div>
      </div>

      {/* The active entry is announced, so the position is not colour or shape
          alone (UI_UX_STANDARDS 7.3). */}
      <p aria-live="polite" className="sr-only">
        {item ? `${item.title}, entry ${active + 1} of ${count}` : ''}
      </p>
    </section>
  );
}

export default MoltenRingCarousel;
