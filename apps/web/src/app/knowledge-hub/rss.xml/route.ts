import {WEB_ROUTES} from '@me-palnadu/contracts';
import {escapeXml} from '@me-palnadu/shared';
import {listPublishedArticles} from '../../../lib/api';

/** RSS 2.0 feed. The list endpoint already returns newest-first. */
const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export const GET = async (): Promise<Response> => {
  let articles;
  try {
    articles = await listPublishedArticles({page: 1, limit: 20});
  } catch {
    return new Response('The Knowledge Hub feed is temporarily unavailable.\n', {
      status: 503,
      headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'},
    });
  }

  const items = articles.items
    .map((article) => {
      const link = `${siteUrl}${WEB_ROUTES.knowledgeHub}/${article.slug}`;
      return [
        '    <item>',
        `      <title>${escapeXml(article.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <description>${escapeXml(article.excerpt)}</description>`,
        `      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>`,
        ...article.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>me.palnadu.dev — Knowledge Hub</title>',
    `    <link>${escapeXml(`${siteUrl}${WEB_ROUTES.knowledgeHub}`)}</link>`,
    '    <description>Tutorials, knowledge-transfer guides, troubleshooting notes, and interview preparation on endpoint management, MDM, and security.</description>',
    '    <language>en</language>',
    `    <atom:link href="${escapeXml(`${siteUrl}${WEB_ROUTES.rss}`)}" rel="self" type="application/rss+xml" />`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
};
