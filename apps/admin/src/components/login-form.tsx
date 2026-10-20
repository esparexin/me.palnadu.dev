'use client';

import {useActionState} from 'react';
import {Button, Field, TextInput} from '@me-palnadu/ui';
import {loginAction, type LoginActionState} from '../lib/actions';

export interface LoginFormProps {
  redirectTo?: string | undefined;
}

export const LoginForm = ({redirectTo}: LoginFormProps) => {
  const [state, formAction, isPending] = useActionState<LoginActionState, FormData>(
    loginAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.error !== undefined && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-danger bg-surface p-4 text-body-sm text-danger"
        >
          {state.error}
        </div>
      )}

      {redirectTo !== undefined && <TextInput type="hidden" name="redirectTo" value={redirectTo} />}

      <Field
        id="email"
        label="Email address"
        hint="Registered administrator email"
        error={state.error !== undefined ? 'Check your email address.' : undefined}
      >
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          disabled={isPending}
          invalid={state.error !== undefined}
          placeholder="owner@me.palnadu.dev"
        />
      </Field>

      <Field
        id="password"
        label="Password"
        hint="Account master password"
        error={state.error !== undefined ? 'Check your password.' : undefined}
      >
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
          invalid={state.error !== undefined}
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={isPending}
        className="mt-2 w-full"
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
};
