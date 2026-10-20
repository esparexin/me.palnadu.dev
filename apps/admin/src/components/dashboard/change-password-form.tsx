'use client';

import {useActionState} from 'react';
import {Button, Field, TextInput} from '@me-palnadu/ui';
import {emptyFormState, type FormState} from '../../lib/form-state';

/** Changes the password; the API invalidates every session on success. */
export const ChangePasswordForm = ({
  action,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) => {
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-5">
      {state.error !== undefined && (
        <div
          role="alert"
          className="rounded-md border border-danger bg-surface px-4 py-3 text-body-sm text-danger"
        >
          {state.error}
        </div>
      )}

      <Field
        id="currentPassword"
        label="Current password"
        error={state.fieldErrors?.['currentPassword']}
      >
        <TextInput
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Field
        id="newPassword"
        label="New password"
        hint="At least 12 characters with upper and lower case letters and a digit."
        error={state.fieldErrors?.['newPassword']}
      >
        <TextInput
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Field
        id="confirmPassword"
        label="Confirm new password"
        error={state.fieldErrors?.['confirmPassword']}
      >
        <TextInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? 'Changing…' : 'Change password'}
        </Button>
        <p className="text-meta text-text-tertiary">
          This signs out every session, including this one. You will sign in again.
        </p>
      </div>
    </form>
  );
};
