import {
  API_ROUTES,
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AuditEntrySchema,
  AuditListQuerySchema,
  PaginatedResponseSchema,
  type AuditEntry,
} from '@me-palnadu/contracts';
import {Button, Field, Select} from '@me-palnadu/ui';
import {adminApiFetch, describeActionError} from '../../../lib/api';
import {requireAdmin} from '../../../lib/session';
import {formatDateTime, humanize} from '../../../lib/format';
import {EmptyState, Notice, PageHeader, Pagination} from '../../../components/dashboard/ui';

export const metadata = {title: 'Audit trail'};

interface PageProps {
  searchParams: Promise<{action?: string; entityType?: string; page?: string}>;
}

export default async function AuditPage({searchParams}: PageProps) {
  const admin = await requireAdmin('/dashboard/audit');
  if (admin.role !== 'owner') {
    return (
      <>
        <PageHeader title="Audit trail" description="The audit trail is restricted to the owner." />
        <Notice tone="error">Your role does not permit reading the audit trail.</Notice>
      </>
    );
  }

  const params = await searchParams;
  const queryResult = AuditListQuerySchema.safeParse({
    ...(params.action === undefined ? {} : {action: params.action}),
    ...(params.entityType === undefined ? {} : {entityType: params.entityType}),
    ...(params.page === undefined ? {} : {page: params.page}),
  });
  const query = queryResult.success ? queryResult.data : AuditListQuerySchema.parse({});

  let items: AuditEntry[] = [];
  let page = 1;
  let hasMore = false;
  let error: string | null = null;
  try {
    const search = new URLSearchParams({page: String(query.page)});
    if (query.action !== undefined) search.set('action', query.action);
    if (query.entityType !== undefined) search.set('entityType', query.entityType);
    const response = await adminApiFetch(
      `${API_ROUTES.audit}?${search.toString()}`,
      PaginatedResponseSchema(AuditEntrySchema),
    );
    items = response.items;
    page = response.page;
    hasMore = response.hasMore;
  } catch (caught) {
    error = describeActionError(caught);
  }

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Append-only record of every administrative write. There is no edit or delete route."
      />

      {error !== null && <Notice tone="error">{error}</Notice>}

      <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field id="action" label="Action">
          <Select id="action" name="action" defaultValue={query.action ?? ''}>
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {humanize(action)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="entityType" label="Entity">
          <Select id="entityType" name="entityType" defaultValue={query.entityType ?? ''}>
            <option value="">All entities</option>
            {AUDIT_ENTITY_TYPES.map((entity) => (
              <option key={entity} value={entity}>
                {humanize(entity)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState>No audit entries match this view.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
          <table className="w-full text-left text-body-sm">
            <caption className="sr-only">Administrative writes, newest first</caption>
            <thead className="border-b border-border-subtle text-meta uppercase tracking-wider text-text-tertiary">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Action
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Entity
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Actor
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  When
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border-subtle align-top last:border-b-0"
                >
                  <td className="px-4 py-3 text-text-primary">{humanize(entry.action)}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {humanize(entry.entityType)}
                    <span className="ml-2 font-mono text-meta text-text-tertiary">
                      {entry.entityId.slice(-8)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-meta text-text-tertiary">
                    {entry.actorId.slice(-8)}
                  </td>
                  <td className="px-4 py-3 text-text-tertiary">
                    <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                  </td>
                  <td className="px-4 py-3 text-meta text-text-tertiary">
                    {entry.detail === undefined ? '—' : JSON.stringify(entry.detail)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        hasMore={hasMore}
        basePath="/dashboard/audit"
        query={{action: query.action, entityType: query.entityType}}
      />
    </>
  );
}
