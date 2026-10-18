import type {ElementType, ReactNode} from 'react';
import {cn} from '../lib/cn.js';

/** Layout primitive: the only place the page gutter and measure are applied. */
export const Container = ({
  as: Tag = 'div',
  measure = false,
  className,
  children,
}: {
  as?: ElementType;
  measure?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <Tag
    className={cn(
      // min-w-0: as a flex child, the default min-width:auto lets long content
      // push the element wider than the viewport and cause horizontal overflow
      // (UI_UX_STANDARDS 3).
      'mx-auto w-full min-w-0 px-5 md:px-8',
      measure ? 'max-w-measure' : 'max-w-page',
      className,
    )}
  >
    {children}
  </Tag>
);

/** Section rhythm: title, optional supporting line, content. */
export const SectionHeading = ({
  eyebrow,
  title,
  description,
  as: Tag = 'h2',
  id,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  as?: 'h1' | 'h2' | 'h3';
  id?: string;
}) => (
  <div className="flex flex-col gap-3">
    {eyebrow !== undefined && (
      <p className="text-eyebrow font-semibold uppercase tracking-widest text-accent-text">
        {eyebrow}
      </p>
    )}
    <Tag id={id} className={Tag === 'h1' ? 'text-h1 font-semibold' : 'text-h2 font-semibold'}>
      {title}
    </Tag>
    {description !== undefined && (
      <p className="max-w-measure text-lead text-text-secondary">{description}</p>
    )}
  </div>
);
