import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {
  Badge,
  Button,
  ButtonLink,
  Container,
  Field,
  Prose,
  SectionHeading,
  Select,
  TextInput,
  Textarea,
  cn,
} from './index.js';

describe('cn', () => {
  it('joins truthy values and drops falsy ones', () => {
    expect(cn('a', false, undefined, 'b', null)).toBe('a b');
  });
});

describe('Button', () => {
  it('defaults to a non-submitting button so it cannot post a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', {name: 'Save'})).toHaveAttribute('type', 'button');
  });

  it('exposes each variant with token classes only', () => {
    const {rerender} = render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('border-border-default');
    expect(button.className).not.toMatch(/#[0-9a-f]{3}/i);
    rerender(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button').className).toContain('bg-accent');
  });

  it('keeps a minimum target size of 44px for the large variant', () => {
    render(<Button size="lg">Contact me</Button>);
    expect(screen.getByRole('button').className).toContain('min-h-12');
  });

  it('renders a link as a link, not a button', () => {
    render(<ButtonLink href="/resume">View Resume</ButtonLink>);
    const link = screen.getByRole('link', {name: 'View Resume'});
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/resume');
  });
});

describe('Field', () => {
  it('binds the label to the input by id', () => {
    render(
      <Field id="email" label="Email address">
        <TextInput id="email" name="email" />
      </Field>,
    );
    expect(screen.getByLabelText('Email address')).toHaveAttribute('id', 'email');
  });

  it('marks an invalid field and links the error message', () => {
    render(
      <Field id="email" label="Email address" error="Enter a valid email address">
        <TextInput id="email" invalid />
      </Field>,
    );
    const input = screen.getByLabelText('Email address');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
    expect(screen.getByText('Enter a valid email address')).toHaveAttribute('id', 'email-error');
  });

  it('links a hint without marking the field invalid', () => {
    render(
      <Field id="email" label="Email" hint="Work address preferred">
        <TextInput id="email" />
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-describedby', 'email-hint');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('does not render a hint alongside an error', () => {
    render(
      <Field id="email" label="Email" hint="Work address preferred" error="Required">
        <TextInput id="email" />
      </Field>,
    );
    expect(screen.queryByText('Work address preferred')).toBeNull();
  });
});

describe('layout primitives', () => {
  it('applies the prose measure when asked', () => {
    const {container} = render(<Container measure>text</Container>);
    expect(container.firstElementChild?.className).toContain('max-w-measure');
  });

  it('renders an eyebrow, title, and description', () => {
    render(<SectionHeading eyebrow="Knowledge" title="Knowledge Hub" description="Guides" />);
    expect(screen.getByRole('heading', {name: 'Knowledge Hub'})).toBeInTheDocument();
    expect(screen.getByText('Guides')).toBeInTheDocument();
  });

  it('can render a page-level h1', () => {
    render(<SectionHeading as="h1" title="Kalyan Medaboina" />);
    expect(screen.getByRole('heading', {level: 1})).toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('conveys status in text and uses token classes only', () => {
    render(<Badge tone="success">Published</Badge>);
    const badge = screen.getByText('Published');
    expect(badge.className).toContain('text-success');
    expect(badge.className).not.toMatch(/#[0-9a-f]{3}/i);
  });
});

describe('form controls', () => {
  it('binds a textarea to its label and marks invalidity', () => {
    render(
      <Field id="body" label="Article body" error="Body is required">
        <Textarea id="body" invalid />
      </Field>,
    );
    const field = screen.getByLabelText('Article body');
    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  it('binds a select to its label', () => {
    render(
      <Field id="kind" label="Article kind">
        <Select id="kind" defaultValue="tutorial">
          <option value="tutorial">Tutorial</option>
        </Select>
      </Field>,
    );
    expect(screen.getByLabelText('Article kind')).toHaveValue('tutorial');
  });
});

describe('Prose', () => {
  it('renders the Markdown subset as elements with heading anchors', () => {
    render(<Prose source={'## Evidence first\n\nA claim needs **proof**.\n\n- one\n- two'} />);
    expect(screen.getByRole('heading', {level: 2, name: 'Evidence first'})).toHaveAttribute(
      'id',
      'evidence-first',
    );
    expect(screen.getByText('proof').closest('strong')).not.toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('never interprets raw HTML from stored Markdown', () => {
    const {container} = render(<Prose source={'<script>alert(1)</script>'} />);
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  });

  it('drops an unsafe link scheme rather than rendering it', () => {
    render(<Prose source={'[click](javascript:alert(1))'} />);
    expect(screen.getByRole('link', {name: 'click'})).toHaveAttribute('href', '#');
  });
});
