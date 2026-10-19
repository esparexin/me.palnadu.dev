import Link from 'next/link';
import {
  API_ROUTES,
  FaqListQuerySchema,
  FaqSchema,
  FAQ_CATEGORIES,
  PaginatedResponseSchema,
  type Faq,
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

export const metadata = {title: 'FAQ'};

interface PageProps {
  searchParams: Promise<{
    category?: string;
    status?: string;
    q?: string;
    page?: string;
    error?: string;
  }>;
}

export default async function FaqListPage({searchParams}: PageProps) {
  const params = await searchParams;
  const queryResult = FaqListQuerySchema.safeParse({
    ...(params.category === undefined ? {} : {category: params.category}),
    ...(params.status === undefined ? {} : {status: params.status}),
    ...(params.q === undefined ? {} : {q: params.q}),
    ...(params.page === undefined ? {} : {page: params.page}),
  });
  const query = queryResult.success ? queryResult.data : FaqListQuerySchema.parse({});

  let items: Faq[] = [];
  let page = 1;
  let hasMore = false;
  let error: string | null = params.error ?? null;
  try {
    const search = new URLSearchParams({page: String(query.page)});
    if (query.category !== undefined) search.set('category', query.category);
    if (query.status !== undefined) search.set('status', query.status);
    if (query.q !== undefined) search.set('q', query.q);

    const response = await adminApiFetch(
      `${API_ROUTES.faqAdmin}?${search.toString()}`,
      PaginatedResponseSchema(FaqSchema),
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
        title="FAQ"
        description="Short answers to recurring questions. Drafts stay out of the public FAQ page."
        actions={<ButtonLink href="/dashboard/faq/new">New question</ButtonLink>}
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
        <Field id="category" label="Category">
          <Select id="category" name="category" defaultValue={query.category ?? ''}>
            <option value="">All categories</option>
            {FAQ_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="q" label="Search question or answer">
          <TextInput id="q" name="q" type="search" defaultValue={query.q ?? ''} />
        </Field>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState>
          No questions match this view.{' '}
          <Link href="/dashboard/faq/new" className="text-accent-text underline underline-offset-2">
            Add the first one
          </Link>
          .
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
          <table className="w-full text-left text-body-sm">
            <caption className="sr-only">FAQ entries</caption>
            <thead className="border-b border-border-subtle text-meta uppercase tracking-wider text-text-tertiary">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Question
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Order
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((faq) => (
                <tr key={faq.id} className="border-b border-border-subtle last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/faq/${faq.id}`}
                      className="font-medium text-text-primary underline-offset-2 hover:underline"
                    >
                      {faq.question}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {faq.category.replaceAll('_', ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={faq.status} />
                  </td>
                  <td className="px-4 py-3 text-text-tertiary">{faq.sortIndex}</td>
                  <td className="px-4 py-3 text-text-tertiary">
                    <time dateTime={faq.updatedAt}>{formatDate(faq.updatedAt)}</time>
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
        basePath="/dashboard/faq"
        query={{status: query.status, category: query.category, q: query.q}}
      />
    </>
  );
}
