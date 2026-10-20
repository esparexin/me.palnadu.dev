/**
 * Markdown subset renderer (ADR-0010 §2).
 *
 * The Knowledge Hub stores Markdown source. This module parses the subset the
 * repository needs into a small, typed AST. It never produces HTML strings, so
 * there is no `dangerouslySetInnerHTML` in the path and raw HTML in an article is
 * rendered as text rather than interpreted.
 *
 * Supported: `##`–`####` headings, paragraphs, unordered and ordered lists,
 * fenced code blocks, blockquotes, horizontal rules, and inline code, bold,
 * italic, and links.
 *
 * Deliberately unsupported: raw HTML, tables, footnotes, images, and nested
 * lists. Adding one is a change to this parser plus a test, not a configuration
 * flag on a dependency.
 */

import type {BlockNode, Heading, InlineNode} from './markdown-types.js';
import {headingId, inlineText, parseInline} from './markdown-inline.js';

export type {InlineNode, BlockNode, Heading} from './markdown-types.js';
export {headingId, inlineText, inlineToText, parseInline, safeHref} from './markdown-inline.js';

const HEADING = /^(#{2,4})\s+(.+)$/u;
const FENCE = /^```([A-Za-z0-9_+-]*)\s*$/u;
const UNORDERED = /^[-*]\s+(.+)$/u;
const ORDERED = /^\d+\.\s+(.+)$/u;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/u;
const QUOTE = /^>\s?(.*)$/u;

/** Parses Markdown source into blocks. */
export const parseMarkdown = (source: string): BlockNode[] => {
  const blocks: BlockNode[] = [];
  const lines = source.replace(/\r\n/gu, '\n').split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line.trim());
    if (fence !== null) {
      const language = fence[1] ?? '';
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? '').trim().startsWith('```')) {
        body.push(lines[index] ?? '');
        index += 1;
      }
      index += 1;
      blocks.push({type: 'code', language, value: body.join('\n')});
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      const depth = heading[1]?.length as 2 | 3 | 4;
      const children = parseInline((heading[2] ?? '').trim());
      blocks.push({type: 'heading', depth, id: headingId(inlineText(children)), children});
      index += 1;
      continue;
    }

    if (RULE.test(line.trim())) {
      blocks.push({type: 'rule'});
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index] ?? '')) {
        body.push(QUOTE.exec(lines[index] ?? '')?.[1] ?? '');
        index += 1;
      }
      blocks.push({type: 'quote', children: parseInline(body.join(' '))});
      continue;
    }

    if (UNORDERED.test(line) || ORDERED.test(line)) {
      const ordered = ORDERED.test(line);
      const matcher = ordered ? ORDERED : UNORDERED;
      const items: InlineNode[][] = [];
      while (index < lines.length) {
        const current = lines[index] ?? '';
        const match = matcher.exec(current);
        if (match === null) break;
        items.push(parseInline(match[1] ?? ''));
        index += 1;
      }
      blocks.push({type: 'list', ordered, items});
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? '';
      if (
        current.trim().length === 0 ||
        HEADING.test(current) ||
        FENCE.test(current.trim()) ||
        RULE.test(current.trim()) ||
        QUOTE.test(current) ||
        UNORDERED.test(current) ||
        ORDERED.test(current)
      ) {
        break;
      }
      paragraph.push(current.trim());
      index += 1;
    }
    blocks.push({type: 'paragraph', children: parseInline(paragraph.join(' '))});
  }

  return blocks;
};

/** Every heading in document order, for a table of contents. */
export const extractHeadings = (blocks: readonly BlockNode[]): Heading[] =>
  blocks.flatMap((block) =>
    block.type === 'heading'
      ? [{depth: block.depth, id: block.id, text: inlineText(block.children)}]
      : [],
  );

/** Plain text of the whole document, used for reading time and excerpts. */
export const markdownToPlainText = (source: string): string =>
  parseMarkdown(source)
    .map((block) => {
      switch (block.type) {
        case 'heading':
        case 'paragraph':
        case 'quote':
          return inlineText(block.children);
        case 'list':
          return block.items.map(inlineText).join(' ');
        case 'code':
          return block.value;
        case 'rule':
          return '';
        default:
          return '';
      }
    })
    .filter((part) => part.length > 0)
    .join('\n\n');
