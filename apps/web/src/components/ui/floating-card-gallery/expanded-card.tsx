'use client';

import {useEffect, type FC} from 'react';
import Link from 'next/link';
import {X, Clock, BookOpen, ExternalLink} from 'lucide-react';
import type {FloatingGalleryCard} from './types';

interface ExpandedCardProps {
  card: FloatingGalleryCard;
  onClose: () => void;
}

export const ExpandedCard: FC<ExpandedCardProps> = ({card, onClose}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const articleHref = card.href ?? `/knowledge-hub/${card.slug}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`expanded-title-${card.id}`}
      className="absolute inset-0 z-50 flex flex-col justify-between rounded-xl border border-border-default bg-surface-inverse/95 p-6 backdrop-blur-md transition-all duration-base ease-standard"
      style={{transform: 'translateZ(60px)'}}
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {card.category ? (
              <span className="rounded-pill bg-accent/20 px-2.5 py-0.5 text-meta font-medium text-accent-subtle">
                {card.category}
              </span>
            ) : null}
            {card.difficulty ? (
              <span className="rounded-pill bg-surface-muted/20 px-2.5 py-0.5 text-meta capitalize text-surface-muted">
                {card.difficulty}
              </span>
            ) : null}
            {card.readingTimeMinutes ? (
              <span className="flex items-center gap-1 text-meta text-surface-muted">
                <Clock className="h-3 w-3" />
                {card.readingTimeMinutes} min read
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-pill text-surface-muted transition-colors hover:bg-surface-muted/20 hover:text-text-inverse focus-visible:outline-2 focus-visible:outline-focus"
            aria-label="Close card details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <h3
          id={`expanded-title-${card.id}`}
          className="mt-4 text-h3 font-semibold text-text-inverse"
        >
          {card.title}
        </h3>

        <p className="mt-3 text-body-sm leading-relaxed text-surface-muted">
          {card.fullDescription ?? card.description}
        </p>

        {card.tags && card.tags.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {card.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-pill border border-border-subtle/30 bg-surface-muted/10 px-2 py-0.5 text-meta text-surface-muted"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle/20 pt-4">
        <div className="flex items-center gap-2">
          {card.avatar ? (
            <img
              src={card.avatar}
              alt={card.author ?? 'Author'}
              className="h-7 w-7 rounded-pill object-cover ring-1 ring-border-default"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-pill bg-accent text-meta font-medium text-text-inverse">
              <BookOpen className="h-3.5 w-3.5" />
            </div>
          )}
          <span className="text-body-sm text-surface-muted">
            {card.author ?? 'Kalyan V Medaboina'}
          </span>
        </div>

        <Link
          href={articleHref}
          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-accent px-4 py-2 text-body-sm font-medium text-text-inverse transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-focus"
        >
          <span>Read Article</span>
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};
