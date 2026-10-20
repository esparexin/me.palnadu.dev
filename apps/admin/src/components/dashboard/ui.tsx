import type {ReactNode} from 'react';
import Link from 'next/link';
import {Badge, type BadgeTone} from '@me-palnadu/ui';
import type {ContentStatus} from '@me-palnadu/contracts';

/** Small server-renderable building blocks shared by the dashboard pages. */

export const PageHeader = ({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h1 className="text-h2 font-semibold text-text-primary">{title}</h1>
      <p className="mt-2 max-w-2xl text-body-sm text-text-secondary">{description}</p>
    </div>
    {actions !== undefined && <div className="flex shrink-0 gap-2">{actions}</div>}
  </div>
);

const STATUS_TONE: Record<ContentStatus, BadgeTone> = {
  draft: 'warning',
  published: 'success',
  archived: 'neutral',
};

export const StatusBadge = ({status}: {status: ContentStatus}) => (
  <Badge tone={STATUS_TONE[status]}>{status}</Badge>
);

export const Notice = ({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'error';
  children: ReactNode;
}) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={
      tone === 'error'
        ? 'rounded-md border border-danger bg-surface px-4 py-3 text-body-sm text-danger'
        : 'rounded-md border border-border-default bg-surface px-4 py-3 text-body-sm text-text-secondary'
    }
  >
    {children}
  </div>
);

export const EmptyState = ({children}: {children: ReactNode}) => (
  <div className="rounded-lg border border-dashed border-border-default bg-surface px-6 py-12 text-center text-body-sm text-text-tertiary">
    {children}
  </div>
);

export const Pagination = ({
  page,
  hasMore,
  basePath,
  query,
}: {
  page: number;
  hasMore: boolean;
  basePath: string;
  query?: Record<string, string | undefined>;
}) => {
  const href = (target: number): string => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value.length > 0) params.set(key, value);
    }
    params.set('page', String(target));
    return `${basePath}?${params.toString()}`;
  };

  if (page === 1 && !hasMore) return null;

  return (
    <div className="flex items-center justify-between text-body-sm">
      {page > 1 ? (
        <Link
          className="inline-flex min-h-6 items-center text-accent-text underline underline-offset-2"
          href={href(page - 1)}
        >
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-text-tertiary">Page {page}</span>
      {hasMore ? (
        <Link
          className="inline-flex min-h-6 items-center text-accent-text underline underline-offset-2"
          href={href(page + 1)}
        >
          Next
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
};
