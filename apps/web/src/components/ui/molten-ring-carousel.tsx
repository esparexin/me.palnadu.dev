'use client';

import * as React from 'react';
import {cn} from '@me-palnadu/ui';
import {FUSE} from './molten-ring/constants';
import type {MoltenRingCarouselProps, MoltenRingItem} from './molten-ring/types';
import {useMoltenRing} from './molten-ring/use-molten-ring';

export type {MoltenRingItem, MoltenRingCarouselProps};

export function MoltenRingCarousel({
  items,
  brand,
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
  });

  const item = items[active];

  if (!supported) {
    return (
      <section
        aria-roledescription="carousel"
        aria-label={brand ?? 'Core Competencies'}
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

  return (
    <section
      aria-roledescription="carousel"
      aria-label={brand ?? 'Core Competencies'}
      className={cn(
        'relative h-full min-h-[26rem] w-full select-none overflow-hidden bg-surface text-text-primary',
        className,
      )}
      {...props}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full cursor-grab touch-pan-x text-text-primary outline-none active:cursor-grabbing"
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') step(1);
          else if (event.key === 'ArrowUp') step(-1);
          else return;
          event.preventDefault();
        }}
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

      {/* Primary active slide readout */}
      <div className="pointer-events-none absolute left-[5%] top-1/2 -translate-y-1/2">
        <div className="text-meta font-medium tabular-nums text-text-tertiary">
          {String(active + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
        </div>
        <div className="mt-1 text-h2 font-bold tracking-tight text-text-primary">{item?.title}</div>
      </div>

      {item?.meta ? (
        <div className="pointer-events-none absolute right-[5%] top-1/2 -translate-y-1/2 text-right text-body-sm font-medium text-text-secondary">
          {item.meta}
        </div>
      ) : null}
    </section>
  );
}

export default MoltenRingCarousel;
