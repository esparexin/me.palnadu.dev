import Link from 'next/link';
import {
  API_ROUTES,
  ArticleListQuerySchema,
  ArticleSummarySchema,
  PaginatedResponseSchema,
  type ArticleSummary,
} from '@me-palnadu/contracts';
import {Button, ButtonLink, Field, Select, TextInput} from '@me-palnadu/ui';
import {adminApiFetch, describeActionError} from '../../../lib/api';
import {formatDate} from '../../../lib/format';
import {
  EmptyState,
  Notice,
  PageHeader,
  Pagination,
  StatusBadge,
} from '../../../components/dashboard/ui';

export const metadata = {title: 'Knowledge Hub'};

interface PageProps {
  searchParams: Promise<{status?: string; q?: string; page?: string; error?: string}>;
}

export default async function KnowledgeListPage({searchParams}: PageProps) {
  const params = await searchParams;
  const queryResult = ArticleListQuerySchema.safeParse({
    ...(params.status === undefined ? {} : {status: params.status}),
    ...(params.q === undefined ? {} : {q: params.q}),
    ...(params.page === undefined ? {} : {page: params.page}),
  });
  const query = queryResult.success ? queryResult.data : ArticleListQuerySchema.parse({});

  let items: ArticleSummary[] = [];
  let page = 1;
  let hasMore = false;
  let error: string | null = params.error ?? null;
  try {
    const response = await adminApiFetch(
      `${API_ROUTES.knowledgeAdmin}?${new URLSearchParams({
        page: String(query.page),
        ...(query.status === undefined ? {} : {status: query.status}),
        ...(query.q === undefined ? {} : {q: query.q}),
      }).toString()}`,
      PaginatedResponseSchema(ArticleSummarySchema),
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
        title="Knowledge Hub"
        description="Guides, tutorials, and interview preparation. A draft is invisible to visitors until it is published."
        actions={<ButtonLink href="/dashboard/knowledge/new">New article</ButtonLink>}
      />

      {error !== null && <Notice tone="error">{error}</Notice>}

      <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field id="status" label="Status">
          <Select id="status" name="status" defaultValue={query.status ?? ''}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
        <Field id="q" label="Search title, excerpt, or tag">
          <TextInput id="q" name="q" type="search" defaultValue={query.q ?? ''} />
        </Field>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState>
          No articles match this view.{' '}
          <Link
            href="/dashboard/knowledge/new"
            className="text-accent-text underline underline-offset-2"
          >
            Write the first one
          </Link>
          .
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
          <table className="w-full text-left text-body-sm">
            <caption className="sr-only">Articles in the Knowledge Hub</caption>
            <thead className="border-b border-border-subtle text-meta uppercase tracking-wider text-text-tertiary">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Title
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Kind
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((article) => (
                <tr key={article.id} className="border-b border-border-subtle last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/knowledge/${article.id}`}
                      className="inline-flex min-h-6 items-center font-medium text-text-primary underline-offset-2 hover:underline"
                    >
                      {article.title}
                    </Link>
                    <p className="mt-0.5 font-mono text-meta text-text-tertiary">{article.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {article.kind.replaceAll('_', ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={article.status} />
                  </td>
                  <td className="px-4 py-3 text-text-tertiary">
                    <time dateTime={article.updatedAt}>{formatDate(article.updatedAt)}</time>
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
        basePath="/dashboard/knowledge"
        query={{status: query.status, q: query.q}}
      />
    </>
  );
}
