import type {ReactNode} from 'react';
import {parseMarkdown, type BlockNode, type InlineNode} from '@me-palnadu/shared';
import {cn} from '../lib/cn.js';

/**
 * The one Markdown renderer (ADR-0010 §2).
 *
 * It consumes the AST from `@me-palnadu/shared` and maps nodes to React elements.
 * No HTML string is ever created, so a `script` tag in stored Markdown is displayed
 * as text and can never execute. The parser has already refused unsafe link
 * schemes; this component does not add a second, divergent rule.
 */
export interface ProseProps {
  source: string;
  className?: string;
}

const Inline = ({nodes}: {nodes: readonly InlineNode[]}) => (
  <>
    {nodes.map((node, index) => {
      switch (node.type) {
        case 'text':
          return <span key={index}>{node.value}</span>;
        case 'code':
          return (
            <code
              key={index}
              className="rounded-sm bg-surface-muted px-1 py-0.5 font-mono text-meta text-text-primary"
            >
              {node.value}
            </code>
          );
        case 'strong':
          return (
            <strong key={index} className="font-semibold">
              <Inline nodes={node.children} />
            </strong>
          );
        case 'emphasis':
          return (
            <em key={index}>
              <Inline nodes={node.children} />
            </em>
          );
        case 'link':
          return (
            <a
              key={index}
              href={node.href}
              className="text-accent-text underline underline-offset-2 hover:text-accent-hover"
            >
              <Inline nodes={node.children} />
            </a>
          );
        default:
          return null;
      }
    })}
  </>
);

const Heading = ({depth, id, children}: {depth: 2 | 3 | 4; id: string; children: ReactNode}) => {
  if (depth === 2) {
    return (
      <h2 id={id} className="mt-10 scroll-mt-24 text-h2 font-semibold text-text-primary first:mt-0">
        {children}
      </h2>
    );
  }
  if (depth === 3) {
    return (
      <h3 id={id} className="mt-8 scroll-mt-24 text-h3 font-semibold text-text-primary">
        {children}
      </h3>
    );
  }
  return (
    <h4 id={id} className="mt-6 scroll-mt-24 text-body font-semibold text-text-primary">
      {children}
    </h4>
  );
};

const Block = ({block}: {block: BlockNode}) => {
  switch (block.type) {
    case 'heading':
      return (
        <Heading depth={block.depth} id={block.id}>
          <Inline nodes={block.children} />
        </Heading>
      );
    case 'paragraph':
      return (
        <p className="mt-4 text-body text-text-secondary first:mt-0">
          <Inline nodes={block.children} />
        </p>
      );
    case 'code':
      return (
        <pre className="mt-6 overflow-x-auto rounded-md border border-border-subtle bg-surface-muted p-4 text-meta">
          <code className="font-mono text-text-primary">{block.value}</code>
        </pre>
      );
    case 'quote':
      return (
        <blockquote className="mt-6 border-l-2 border-accent pl-4 text-body italic text-text-secondary">
          <Inline nodes={block.children} />
        </blockquote>
      );
    case 'list': {
      const items = block.items.map((item, index) => (
        <li key={index} className="mt-1">
          <Inline nodes={item} />
        </li>
      ));
      return block.ordered ? (
        <ol className="mt-4 list-decimal pl-6 text-body text-text-secondary">{items}</ol>
      ) : (
        <ul className="mt-4 list-disc pl-6 text-body text-text-secondary">{items}</ul>
      );
    }
    case 'rule':
      return <hr className="my-10 border-border-subtle" />;
    default:
      return null;
  }
};

export const Prose = ({source, className}: ProseProps) => {
  const blocks = parseMarkdown(source);
  return (
    <div className={cn('max-w-measure', className)}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
};
