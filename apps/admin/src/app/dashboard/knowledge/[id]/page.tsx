import Link from 'next/link';
import {notFound} from 'next/navigation';
import {API_ROUTES, ArticleSchema} from '@me-palnadu/contracts';
import {Badge, Button, ButtonLink} from '@me-palnadu/ui';
import {adminApiFetch, describeActionError} from '../../../../lib/api';
import {getAuthenticatedAdmin} from '../../../../lib/session';
import {formatDateTime} from '../../../../lib/format';
import {ArticleForm} from '../../../../components/dashboard/article-form';
import {ConfirmButton} from '../../../../components/dashboard/confirm-button';
import {Notice, PageHeader, StatusBadge} from '../../../../components/dashboard/ui';
import {
  deleteArticleAction,
  transitionArticleAction,
  updateArticleAction,
} from '../../../../lib/content-actions';

export const metadata = {title: 'Edit article'};

interface PageProps {
  params: Promise<{id: string}>;
}

export default async function EditArticlePage({params}: PageProps) {
  const {id} = await params;
  const admin = await getAuthenticatedAdmin();

  let article;
  try {
    article = await adminApiFetch(`${API_ROUTES.knowledgeAdmin}/${id}`, ArticleSchema);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'NOT_FOUND') notFound();
    return (
      <>
        <PageHeader title="Edit article" description="The article could not be loaded." />
        <Notice tone="error">{describeActionError(error)}</Notice>
        <ButtonLink href="/dashboard/knowledge" variant="secondary" size="sm">
          Back to articles
        </ButtonLink>
      </>
    );
  }

  const siteUrl = process.env['ADMIN_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';
  const update = updateArticleAction.bind(null, article.id);

  return (
    <>
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/knowledge"
          className="text-body-sm text-accent-text underline-offset-2 hover:underline"
        >
          ← All articles
        </Link>
        <PageHeader
          title={article.title}
          description={article.excerpt}
          actions={
            article.status === 'published' ? (
              <a
                href={`${siteUrl}/knowledge-hub/${article.slug}`}
                className="inline-flex min-h-8 items-center rounded-md border border-border-default px-3 text-body-sm font-medium text-text-primary"
                target="_blank"
                rel="noreferrer"
              >
                View live
              </a>
            ) : undefined
          }
        />
        <div className="flex flex-wrap items-center gap-3 text-meta text-text-tertiary">
          <StatusBadge status={article.status} />
          <Badge tone="accent">{article.kind.replaceAll('_', ' ')}</Badge>
          <span>Updated {formatDateTime(article.updatedAt)}</span>
          {article.publishedAt !== undefined && (
            <span>Published {formatDateTime(article.publishedAt)}</span>
          )}
        </div>
      </div>

      <ArticleForm action={update} article={article} submitLabel="Save changes" />

      <section
        aria-labelledby="publication"
        className="flex max-w-3xl flex-col gap-4 border-t border-border-subtle pt-8"
      >
        <h2 id="publication" className="text-h3 font-semibold text-text-primary">
          Publication
        </h2>
        <p className="text-body-sm text-text-secondary">
          Publishing makes the article live and invalidates the public page cache. Unpublishing
          returns it to draft and clears its publication instant.
        </p>
        <div className="flex flex-wrap gap-3">
          {article.status !== 'published' && (
            <form action={transitionArticleAction.bind(null, article.id, 'publish')}>
              <Button type="submit">Publish</Button>
            </form>
          )}
          {article.status === 'published' && (
            <>
              <form action={transitionArticleAction.bind(null, article.id, 'unpublish')}>
                <Button type="submit" variant="secondary">
                  Unpublish
                </Button>
              </form>
              <form action={transitionArticleAction.bind(null, article.id, 'archive')}>
                <Button type="submit" variant="secondary">
                  Archive
                </Button>
              </form>
            </>
          )}
          {article.status === 'archived' && (
            <form action={transitionArticleAction.bind(null, article.id, 'publish')}>
              <Button type="submit">Publish again</Button>
            </form>
          )}
        </div>
      </section>

      {admin?.role === 'owner' && (
        <section
          aria-labelledby="delete-article"
          className="flex max-w-3xl flex-col gap-3 rounded-lg border border-border-default p-5"
        >
          <h2 id="delete-article" className="text-body font-semibold text-text-primary">
            Delete article
          </h2>
          <p className="text-body-sm text-text-secondary">
            Deletion is permanent and removes the article from the audit history&apos;s subject, not
            from the audit log itself.
          </p>
          <form action={deleteArticleAction.bind(null, article.id)}>
            <ConfirmButton message={`Delete “${article.title}”? This cannot be undone.`}>
              Delete permanently
            </ConfirmButton>
          </form>
        </section>
      )}
    </>
  );
}
