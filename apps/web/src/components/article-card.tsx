import Link from 'next/link';
import {Badge} from '@me-palnadu/ui';
import {ARTICLE_KIND_LABELS, type PublicArticleSummary} from '@me-palnadu/contracts';
import {formatPublished} from '../lib/format';

/** An index card. The whole card is one link, so the target is unambiguous and
 * there is no nested interactive element (UI_UX_STANDARDS 7.4). */
export const ArticleCard = ({article}: {article: PublicArticleSummary}) => (
  <article className="flex">
    <Link
      href={`/knowledge-hub/${article.slug}`}
      className="flex w-full flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-6 hover:border-border-default"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{ARTICLE_KIND_LABELS[article.kind]}</Badge>
        {article.difficulty !== undefined && <Badge>{article.difficulty}</Badge>}
      </div>
      <h2 className="text-h3 font-semibold">{article.title}</h2>
      <p className="text-body-sm text-text-secondary">{article.excerpt}</p>
      {article.tags.length > 0 && (
        <ul aria-label="Tags" className="flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <li key={tag}>
              <Badge tone="neutral">{tag}</Badge>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto text-meta text-text-tertiary">
        <time dateTime={article.publishedAt}>{formatPublished(article.publishedAt)}</time>
      </p>
    </Link>
  </article>
);
