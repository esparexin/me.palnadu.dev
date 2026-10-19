'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {
  API_ROUTES,
  NoContentSchema,
  ChangePasswordRequestSchema,
  RevokeSessionSchema,
  type ChangePasswordRequest,
} from '@me-palnadu/contracts';
import {adminApiFetch, describeActionError} from './api';
import {clearSessionCookie} from './session';
import type {FormState} from './form-state';

/** Session revocation and credential changes (ADR-0009, ADR-0010 §6). */

export const revokeSessionAction = async (sessionId: string): Promise<void> => {
  const parsed = RevokeSessionSchema.safeParse({sessionId});
  if (!parsed.success) {
    redirect('/dashboard/security?error=That%20session%20identifier%20is%20not%20valid.');
  }

  try {
    await adminApiFetch(API_ROUTES.auth.sessionsRevoke, NoContentSchema, {
      method: 'POST',
      body: parsed.data,
    });
  } catch (error) {
    redirect(`/dashboard/security?error=${encodeURIComponent(describeActionError(error))}`);
  }

  revalidatePath('/dashboard/security');
  redirect('/dashboard/security?notice=Session%20revoked.');
};

export const changePasswordAction = async (
  _previous: FormState,
  formData: FormData,
): Promise<FormState> => {
  const currentPassword = formData.get('currentPassword');
  const newPassword = formData.get('newPassword');
  const confirmPassword = formData.get('confirmPassword');

  if (
    typeof currentPassword !== 'string' ||
    typeof newPassword !== 'string' ||
    typeof confirmPassword !== 'string'
  ) {
    return {error: 'All three password fields are required.'};
  }
  if (newPassword !== confirmPassword) {
    return {fieldErrors: {confirmPassword: 'The passwords do not match.'}};
  }

  const parsed = ChangePasswordRequestSchema.safeParse({currentPassword, newPassword});
  if (!parsed.success) {
    return {
      fieldErrors: {
        newPassword: parsed.error.issues[0]?.message ?? 'The new password is not valid.',
      },
    };
  }

  try {
    await adminApiFetch(API_ROUTES.auth.changePassword, NoContentSchema, {
      method: 'POST',
      body: parsed.data satisfies ChangePasswordRequest,
    });
  } catch (error) {
    return {error: describeActionError(error)};
  }

  // Every session is invalidated by the token-version increment; holding on to the
  // cookie would only send the browser into a 401 loop.
  await clearSessionCookie();
  redirect('/login?notice=Password%20changed.%20Sign%20in%20again.');
};
