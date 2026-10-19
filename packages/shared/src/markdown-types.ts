/**
 * Markdown AST node type declarations (ADR-0010 §2).
 *
 * Types for the restricted Markdown AST consumed by the Knowledge Hub and UI components.
 */

export type InlineNode =
  | {type: 'text'; value: string}
  | {type: 'code'; value: string}
  | {type: 'strong'; children: InlineNode[]}
  | {type: 'emphasis'; children: InlineNode[]}
  | {type: 'link'; href: string; children: InlineNode[]};

export type BlockNode =
  | {type: 'heading'; depth: 2 | 3 | 4; id: string; children: InlineNode[]}
  | {type: 'paragraph'; children: InlineNode[]}
  | {type: 'code'; language: string; value: string}
  | {type: 'quote'; children: InlineNode[]}
  | {type: 'list'; ordered: boolean; items: InlineNode[][]}
  | {type: 'rule'};

export interface Heading {
  depth: 2 | 3 | 4;
  id: string;
  text: string;
}
