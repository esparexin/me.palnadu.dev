'use client';

import {useActionState} from 'react';
import {FAQ_CATEGORIES, type Faq} from '@me-palnadu/contracts';
import {Button, Field, Select, TextInput, Textarea} from '@me-palnadu/ui';
import {emptyFormState, type FormState} from '../../lib/form-state';

/** FAQ authoring form. The answer is Markdown, rendered by the shared parser. */
export const FaqForm = ({
  action,
  faq,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  faq?: Faq;
  submitLabel: string;
}) => {
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-6">
      {state.error !== undefined && (
        <div
          role="alert"
          className="rounded-md border border-danger bg-surface px-4 py-3 text-body-sm text-danger"
        >
          {state.error}
        </div>
      )}

      <Field id="question" label="Question" error={state.fieldErrors?.['question']}>
        <TextInput
          id="question"
          name="question"
          defaultValue={faq?.question ?? ''}
          required
          maxLength={300}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="category" label="Category" error={state.fieldErrors?.['category']}>
          <Select id="category" name="category" defaultValue={faq?.category ?? 'general'}>
            {FAQ_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="sortIndex"
          label="Sort order"
          hint="Lower numbers appear first within a category."
          error={state.fieldErrors?.['sortIndex']}
        >
          <TextInput
            id="sortIndex"
            name="sortIndex"
            type="number"
            min={0}
            max={9999}
            defaultValue={faq?.sortIndex ?? 0}
            required
          />
        </Field>
      </div>

      <Field
        id="answer"
        label="Answer (Markdown)"
        hint="The same restricted Markdown subset as an article: paragraphs, lists, emphasis, links, and code."
        error={state.fieldErrors?.['answer']}
      >
        <Textarea id="answer" name="answer" defaultValue={faq?.answer ?? ''} required rows={12} />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
        <span className="text-meta text-text-tertiary">
          New entries start as drafts; publishing is a separate step.
        </span>
      </div>
    </form>
  );
};
