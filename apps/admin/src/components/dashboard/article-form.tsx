'use client';

import {useActionState} from 'react';
import {ARTICLE_KINDS, DIFFICULTIES, type Article} from '@me-palnadu/contracts';
import {Button, Field, Select, TextInput, Textarea} from '@me-palnadu/ui';
import {emptyFormState, type FormState} from '../../lib/form-state';

/**
 * The authoring form.
 *
 * Validation is not duplicated here: the action reuses the contract schema and
 * returns field errors, and the API validates again. The form's job is to collect
 * the fields and keep the error next to the input that caused it.
 */
export const ArticleForm = ({
  action,
  article,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  article?: Article;
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

      <Field id="title" label="Title" error={state.fieldErrors?.['title']}>
        <TextInput
          id="title"
          name="title"
          defaultValue={article?.title ?? ''}
          required
          maxLength={160}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          id="slug"
          label="Slug"
          hint="Lowercase words separated by hyphens. It is the public URL."
          error={state.fieldErrors?.['slug']}
        >
          <TextInput
            id="slug"
            name="slug"
            defaultValue={article?.slug ?? ''}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            autoComplete="off"
          />
        </Field>

        <Field id="kind" label="Kind" error={state.fieldErrors?.['kind']}>
          <Select id="kind" name="kind" defaultValue={article?.kind ?? 'tutorial'} required>
            {ARTICLE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        id="excerpt"
        label="Excerpt"
        hint="One or two sentences shown in the index and feed."
        error={state.fieldErrors?.['excerpt']}
      >
        <TextInput
          id="excerpt"
          name="excerpt"
          defaultValue={article?.excerpt ?? ''}
          required
          maxLength={400}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          id="tags"
          label="Tags"
          hint="Comma separated, for example: typescript, mongodb"
          error={state.fieldErrors?.['tags']}
        >
          <TextInput
            id="tags"
            name="tags"
            defaultValue={article?.tags.join(', ') ?? ''}
            autoComplete="off"
          />
        </Field>

        <Field
          id="difficulty"
          label="Difficulty"
          hint="Required for interview preparation."
          error={state.fieldErrors?.['difficulty']}
        >
          <Select id="difficulty" name="difficulty" defaultValue={article?.difficulty ?? ''}>
            <option value="">Not specified</option>
            {DIFFICULTIES.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficulty}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        id="body"
        label="Body (Markdown)"
        hint="Headings ## to ####, paragraphs, lists, code fences, quotes, bold, italic, and links. Raw HTML is shown as text."
        error={state.fieldErrors?.['body']}
      >
        <Textarea id="body" name="body" defaultValue={article?.body ?? ''} required rows={22} />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </Button>
        <span className="text-meta text-text-tertiary">
          Publication is a separate step, so a draft cannot go live by saving.
        </span>
      </div>
    </form>
  );
};
