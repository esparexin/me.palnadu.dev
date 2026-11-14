import Link from 'next/link';
import {API_ROUTES, DashboardOverviewSchema, type DashboardOverview} from '@me-palnadu/contracts';
import {ButtonLink} from '@me-palnadu/ui';
import {adminApiFetch, describeActionError} from '../../lib/api';
import {getAuthenticatedAdmin} from '../../lib/session';
import {formatDateTime, humanize} from '../../lib/format';
import {Notice, PageHeader} from '../../components/dashboard/ui';

export const metadata = {title: 'Overview'};

const CountCard = ({label, value, hint}: {label: string; value: number; hint?: string}) => (
  <div className="rounded-lg border border-border-subtle bg-surface p-5 shadow-sm">
    <p className="text-meta font-medium uppercase tracking-wider text-text-tertiary">{label}</p>
    <p className="mt-2 text-h2 font-semibold text-text-primary">{value}</p>
    {hint !== undefined && <p className="mt-1 text-meta text-text-tertiary">{hint}</p>}
  </div>
);

export default async function DashboardPage() {
  const admin = await getAuthenticatedAdmin();

  let overview: DashboardOverview | null = null;
  let error: string | null = null;
  try {
    overview = await adminApiFetch(API_ROUTES.overview, DashboardOverviewSchema);
  } catch (caught) {
    error = describeActionError(caught);
  }

  return (
    <>
      <PageHeader
        title="Overview"
        description="Content that is live, content waiting for review, and the most recent administrative writes."
        actions={
          <ButtonLink href="/dashboard/knowledge/new" size="sm">
            New article
          </ButtonLink>
        }
      />

      {error !== null && <Notice tone="error">{error}</Notice>}

      {overview !== null && (
        <>
          <section aria-labelledby="content-counts" className="flex flex-col gap-4">
            <h2 id="content-counts" className="text-h3 font-semibold text-text-primary">
              Content
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CountCard
                label="Published articles"
                value={overview.articles.published}
                hint={`${overview.articles.draft} draft · ${overview.articles.archived} archived`}
              />
              <CountCard
                label="Media assets"
                value={overview.media.assets}
                hint="Metadata records"
              />
              <CountCard
                label="Media storage"
                value={Math.round(overview.media.totalBytes / 1024)}
                hint="KB recorded in the library"
              />
            </div>
          </section>

          <section aria-labelledby="recent-activity" className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 id="recent-activity" className="text-h3 font-semibold text-text-primary">
                Recent activity
              </h2>
              {admin?.role === 'owner' && (
                <Link
                  href="/dashboard/audit"
                  className="inline-flex min-h-6 items-center text-body-sm text-accent-text underline underline-offset-2"
                >
                  View full audit trail
                </Link>
              )}
            </div>

            {overview.recentActivity.length === 0 ? (
              <p className="rounded-lg border border-border-subtle bg-surface px-5 py-8 text-body-sm text-text-tertiary">
                No administrative writes recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
                <table className="w-full text-left text-body-sm">
                  <caption className="sr-only">The ten most recent administrative writes</caption>
                  <thead className="border-b border-border-subtle text-meta uppercase tracking-wider text-text-tertiary">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Action
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        Entity
                      </th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        When
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentActivity.map((entry) => (
                      <tr key={entry.id} className="border-b border-border-subtle last:border-b-0">
                        <td className="px-4 py-3 text-text-primary">{humanize(entry.action)}</td>
                        <td className="px-4 py-3 text-text-secondary">
                          {humanize(entry.entityType)}{' '}
                          <span className="font-mono text-meta text-text-tertiary">
                            {entry.entityId.slice(-8)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-tertiary">
                          <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
