'use client';

import {type FC, type KeyboardEvent} from 'react';
import Link from 'next/link';
import {BookOpen, Clock, ChevronRight} from 'lucide-react';
import type {FloatingGalleryCard} from './types';
import {ExpandedCard} from './expanded-card';

interface CardItemProps {
  card: FloatingGalleryCard;
  index: number;
  isActive: boolean;
  reducedMotion: boolean;
  accentColor: string;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export const CardItem: FC<CardItemProps> = ({
  card,
  index,
  isActive,
  reducedMotion,
  accentColor,
  onSelect,
  onClose,
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isActive) {
        onClose();
      } else {
        onSelect(index);
      }
    }
  };

  const transformStyle = reducedMotion
    ? undefined
    : {
        transform: isActive ? 'translateZ(60px) scale(1.02)' : 'translateZ(0px)',
        transformStyle: 'preserve-3d' as const,
      };

  return (
    <div
      role="article"
      tabIndex={0}
      aria-expanded={isActive}
      onClick={() => (isActive ? onClose() : onSelect(index))}
      onKeyDown={handleKeyDown}
      style={transformStyle}
      className={`group relative flex min-h-[380px] cursor-pointer flex-col rounded-xl transition-all duration-base ease-standard focus-visible:outline-2 focus-visible:outline-focus ${
        isActive ? 'z-40' : 'z-10 hover:z-20'
      }`}
    >
      {/* Dynamic accent glow */}
      <div
        className="pointer-events-none absolute -inset-0.5 rounded-xl opacity-0 blur-md transition-opacity duration-base group-hover:opacity-60"
        style={{
          background: `radial-gradient(circle at center, ${accentColor}, transparent 75%)`,
        }}
      />

      {/* Main card body */}
      <div
        style={reducedMotion ? undefined : {transformStyle: 'preserve-3d'}}
        className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border-default bg-surface-inverse/90 p-6 shadow-lg backdrop-blur-sm transition-transform duration-base group-hover:border-accent"
      >
        {/* Card image / banner */}
        {card.image ? (
          <div
            style={reducedMotion ? undefined : {transform: 'translateZ(20px)'}}
            className="mb-4 h-40 w-full overflow-hidden rounded-lg bg-surface-muted/10"
          >
            <img
              src={card.image}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover transition-transform duration-slow ease-out group-hover:scale-105"
            />
          </div>
        ) : (
          <div
            style={reducedMotion ? undefined : {transform: 'translateZ(20px)'}}
            className="mb-4 flex h-40 w-full items-center justify-center rounded-lg bg-surface-muted/10 text-accent"
          >
            <BookOpen className="h-12 w-12 opacity-80" />
          </div>
        )}

        {/* Badges */}
        <div
          style={reducedMotion ? undefined : {transform: 'translateZ(25px)'}}
          className="mb-3 flex flex-wrap items-center gap-2"
        >
          {card.category ? (
            <span className="rounded-pill bg-accent/15 px-2 py-0.5 text-meta font-medium text-accent-subtle">
              {card.category}
            </span>
          ) : null}
          {card.difficulty ? (
            <span className="rounded-pill bg-surface-muted/15 px-2 py-0.5 text-meta capitalize text-surface-muted">
              {card.difficulty}
            </span>
          ) : null}
        </div>

        {/* Title & Description */}
        <div style={reducedMotion ? undefined : {transform: 'translateZ(30px)'}} className="flex-1">
          <h3 className="line-clamp-2 text-h3 font-semibold text-text-inverse transition-colors group-hover:text-highlight">
            {card.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-body-sm leading-relaxed text-surface-muted">
            {card.description}
          </p>
        </div>

        {/* Footer info */}
        <div
          style={reducedMotion ? undefined : {transform: 'translateZ(35px)'}}
          className="mt-6 flex items-center justify-between border-t border-border-subtle/15 pt-4"
        >
          <div className="flex items-center gap-2">
            {card.avatar ? (
              <img
                src={card.avatar}
                alt=""
                className="h-6 w-6 rounded-pill object-cover ring-1 ring-border-default"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-pill bg-accent text-meta text-text-inverse">
                K
              </div>
            )}
            <span className="text-meta text-surface-muted">{card.author ?? 'Kalyan V'}</span>
          </div>

          <div className="flex items-center gap-2">
            {card.readingTimeMinutes ? (
              <span className="flex items-center gap-1 text-meta text-surface-muted">
                <Clock className="h-3 w-3" />
                {card.readingTimeMinutes}m
              </span>
            ) : null}
            <Link
              href={card.href ?? `/knowledge-hub/${card.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-7 w-7 items-center justify-center rounded-pill text-surface-muted transition-colors hover:bg-surface-muted/20 hover:text-text-inverse focus-visible:outline-2 focus-visible:outline-focus"
              aria-label={`Read article: ${card.title}`}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Expanded View Modal Overlay */}
        {isActive ? <ExpandedCard card={card} onClose={onClose} /> : null}
      </div>
    </div>
  );
};
