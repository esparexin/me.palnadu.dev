/**
 * Shared state shape for form server actions.
 *
 * Kept out of the `'use server'` module because that boundary may export only async
 * functions; a constant exported from it fails the build.
 */
export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export const emptyFormState: FormState = {};
