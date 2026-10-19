import type {Metadata} from 'next';
import Link from 'next/link';
import {
  ARTICLE_KINDS,
  ARTICLE_KIND_LABELS,
  ArticleListQuerySchema,
  WEB_ROUTES,
  type ArticleKind,
} from '@me-palnadu/contracts';
import {Button, Field, SectionHeading, Select, TextInput} from '@me-palnadu/ui';
import {Navigation} from '../../components/navigation';
import {ArticleCard} from '../../components/article-card';
import {listPublishedArticles} from '../../lib/api';

export const metadata: Metadata = {
  title: 'Knowledge Hub',
  description:
    'Tutorials, knowledge-transfer guides, troubleshooting notes, and interview preparation on endpoint management, MDM, and security.',
  alternates: {
    canonical: WEB_ROUTES.knowledgeHub,
    types: {'application/rss+xml': WEB_ROUTES.rss},
  },
};

const PAGE_SIZE = 9;

interface PageProps {
  searchParams: Promise<{page?: string; kind?: string; q?: string}>;
}

const buildHref = (params: {page?: number; kind?: ArticleKind; q?: string}): string => {
  const search = new URLSearchParams();
  if (params.page !== undefined && params.page > 1) search.set('page', String(params.page));
  if (params.kind !== undefined) search.set('kind', params.kind);
  if (params.q !== undefined && params.q.length > 0) search.set('q', params.q);
  const query = search.toString();
  return query.length === 0 ? WEB_ROUTES.knowledgeHub : `${WEB_ROUTES.knowledgeHub}?${query}`;
};

export default async function KnowledgeHubPage({searchParams}: PageProps) {
  const raw = await searchParams;
  const candidate = ArticleListQuerySchema.safeParse({
    page: raw.page ?? undefined,
    limit: PAGE_SIZE,
    kind: raw.kind ?? undefined,
    q: raw.q ?? undefined,
  });
  const query = candidate.success
    ? candidate.data
    : ArticleListQuerySchema.parse({limit: PAGE_SIZE});

  const result = await listPublishedArticles(query).catch(() => null);
  const totalPages = result === null ? 0 : Math.max(1, Math.ceil(result.total / result.limit));

  return (
    <>
      <Navigation />
      <main id="main-content">
        <section className="mx-auto max-w-page px-5 pb-8 pt-16 md:px-8 md:pt-24">
          <SectionHeading
            as="h1"
            eyebrow="me.palnadu.dev"
            title="Knowledge Hub"
            description="Practical writing on endpoint management, MDM, identity, and security. Every article is reviewed and published deliberately; drafts never appear here."
          />
        </section>

        <section className="mx-auto max-w-page px-5 pb-24 md:px-8">
          <form method="get" className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field id="q" label="Search">
              <TextInput
                id="q"
                name="q"
                type="search"
                defaultValue={query.q ?? ''}
                placeholder="Title, excerpt, or tag"
              />
            </Field>
            <Field id="kind" label="Kind">
              <Select id="kind" name="kind" defaultValue={query.kind ?? ''}>
                <option value="">All kinds</option>
                {ARTICLE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {ARTICLE_KIND_LABELS[kind]}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="secondary">
              Apply
            </Button>
          </form>

          {result === null ? (
            <div
              role="status"
              className="rounded-lg border border-border-subtle bg-surface-subtle p-8"
            >
              <p className="text-body text-text-secondary">
                The Knowledge Hub is temporarily unavailable. Please try again shortly.
              </p>
            </div>
          ) : result.items.length === 0 ? (
            <div className="rounded-lg border border-border-subtle bg-surface-subtle p-8">
              <p className="text-body text-text-secondary">
                No published articles match this view yet.
              </p>
              {(query.q !== undefined || query.kind !== undefined) && (
                <p className="mt-2 text-body-sm text-text-tertiary">
                  <Link href={WEB_ROUTES.knowledgeHub} className="underline underline-offset-2">
                    Clear the filters
                  </Link>{' '}
                  to see everything.
                </p>
              )}
            </div>
          ) : (
            <>
              <p aria-live="polite" className="mb-6 text-meta text-text-tertiary">
                {result.total} {result.total === 1 ? 'article' : 'articles'}
                {totalPages > 1 && ` · page ${result.page} of ${totalPages}`}
              </p>
              <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {result.items.map((article) => (
                  <li key={article.id}>
                    <ArticleCard article={article} />
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <nav
                  aria-label="Knowledge Hub pagination"
                  className="mt-12 flex items-center justify-between"
                >
                  {result.page > 1 ? (
                    <Link
                      href={buildHref({
                        page: result.page - 1,
                        ...(query.kind === undefined ? {} : {kind: query.kind}),
                        ...(query.q === undefined ? {} : {q: query.q}),
                      })}
                      rel="prev"
                      className="inline-flex min-h-6 items-center text-body-sm text-accent-text underline underline-offset-2"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  {result.hasMore ? (
                    <Link
                      href={buildHref({
                        page: result.page + 1,
                        ...(query.kind === undefined ? {} : {kind: query.kind}),
                        ...(query.q === undefined ? {} : {q: query.q}),
                      })}
                      rel="next"
                      className="inline-flex min-h-6 items-center text-body-sm text-accent-text underline underline-offset-2"
                    >
                      Next
                    </Link>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </nav>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}
