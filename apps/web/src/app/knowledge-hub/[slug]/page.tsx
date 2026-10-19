import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ARTICLE_KIND_LABELS, WEB_ROUTES} from '@me-palnadu/contracts';
import {Badge, Prose} from '@me-palnadu/ui';
import {Navigation} from '../../../components/navigation';
import {findPublishedArticle} from '../../../lib/api';
import {formatPublished, readingTime} from '../../../lib/format';

interface PageProps {
  params: Promise<{slug: string}>;
}

export const generateMetadata = async ({params}: PageProps): Promise<Metadata> => {
  const {slug} = await params;
  const article = await findPublishedArticle(slug).catch(() => null);
  if (article === null) return {};
  return {
    title: article.title,
    description: article.excerpt,
    alternates: {canonical: `${WEB_ROUTES.knowledgeHub}/${article.slug}`},
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.excerpt,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      tags: article.tags,
    },
  };
};

export default async function ArticlePage({params}: PageProps) {
  const {slug} = await params;
  const article = await findPublishedArticle(slug);
  if (article === null) notFound();

  return (
    <>
      <Navigation />
      <main id="main-content">
        <article className="mx-auto max-w-page px-5 py-16 md:px-8 md:py-24">
          <nav aria-label="Breadcrumb" className="mb-8 text-body-sm text-text-tertiary">
            <Link
              href={WEB_ROUTES.knowledgeHub}
              className="underline underline-offset-2 hover:text-text-primary"
            >
              Knowledge Hub
            </Link>
            <span aria-hidden="true"> / </span>
            <span>{ARTICLE_KIND_LABELS[article.kind]}</span>
          </nav>

          <header className="flex max-w-measure flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{ARTICLE_KIND_LABELS[article.kind]}</Badge>
              {article.difficulty !== undefined && <Badge>{article.difficulty}</Badge>}
            </div>
            <h1 className="text-h1 font-semibold text-text-primary">{article.title}</h1>
            <p className="text-lead text-text-secondary">{article.excerpt}</p>
            <p className="text-meta text-text-tertiary">
              Published{' '}
              <time dateTime={article.publishedAt}>{formatPublished(article.publishedAt)}</time>
              {' · '}
              {readingTime(article.body)} min read
            </p>
            {article.tags.length > 0 && (
              <ul aria-label="Tags" className="flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <li key={tag}>
                    <Badge>{tag}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </header>

          <div className="mt-12 border-t border-border-subtle pt-10">
            <Prose source={article.body} />
          </div>

          <footer className="mt-16 border-t border-border-subtle pt-8">
            <Link
              href={WEB_ROUTES.knowledgeHub}
              className="text-body-sm text-accent-text underline underline-offset-2"
            >
              Back to the Knowledge Hub
            </Link>
          </footer>
        </article>
      </main>
    </>
  );
}
