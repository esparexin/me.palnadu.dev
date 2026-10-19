'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {
  API_ROUTES,
  NoContentSchema,
  ArticleCreateSchema,
  ArticleSchema,
  ArticleUpdateSchema,
  FaqCreateSchema,
  FaqSchema,
  FaqUpdateSchema,
} from '@me-palnadu/contracts';
import {adminApiFetch, describeActionError} from './api';
import type {FormState} from './form-state';

/**
 * Server actions for content authoring.
 *
 * Validation reuses the same contract schemas the API enforces, so a form cannot
 * disagree with the server about what is valid (SSOT_POLICY §1). The action is a
 * UX affordance; the API still validates independently and remains the authority.
 */

const text = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
};

const tags = (formData: FormData): string[] =>
  text(formData, 'tags')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

const difficulty = (formData: FormData): {difficulty?: string} => {
  const value = text(formData, 'difficulty');
  return value.length === 0 ? {} : {difficulty: value};
};

const fieldErrorsOf = (
  issues: {path: PropertyKey[]; message: string}[],
): Record<string, string> => {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    if (errors[key] === undefined) errors[key] = issue.message;
  }
  return errors;
};

const articleInput = (formData: FormData) => ({
  slug: text(formData, 'slug'),
  kind: text(formData, 'kind'),
  title: text(formData, 'title'),
  excerpt: text(formData, 'excerpt'),
  body: text(formData, 'body'),
  tags: tags(formData),
  ...difficulty(formData),
});

export const createArticleAction = async (
  _previous: FormState,
  formData: FormData,
): Promise<FormState> => {
  const parsed = ArticleCreateSchema.safeParse({...articleInput(formData), status: 'draft'});
  if (!parsed.success) {
    return {fieldErrors: fieldErrorsOf(parsed.error.issues)};
  }

  let id: string;
  try {
    const created = await adminApiFetch(API_ROUTES.knowledgeAdmin, ArticleSchema, {
      method: 'POST',
      body: parsed.data,
    });
    id = created.id;
  } catch (error) {
    return {error: describeActionError(error)};
  }

  revalidatePath('/dashboard/knowledge');
  redirect(`/dashboard/knowledge/${id}`);
};

export const updateArticleAction = async (
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> => {
  const parsed = ArticleUpdateSchema.safeParse(articleInput(formData));
  if (!parsed.success) {
    return {fieldErrors: fieldErrorsOf(parsed.error.issues)};
  }

  try {
    await adminApiFetch(`${API_ROUTES.knowledgeAdmin}/${id}`, ArticleSchema, {
      method: 'PATCH',
      body: parsed.data,
    });
  } catch (error) {
    return {error: describeActionError(error)};
  }

  revalidatePath('/dashboard/knowledge');
  revalidatePath(`/dashboard/knowledge/${id}`);
  return {};
};

type Transition = 'publish' | 'unpublish' | 'archive';

const transitionPath: Record<Transition, string> = {
  publish: 'publish',
  unpublish: 'unpublish',
  archive: 'archive',
};

export const transitionArticleAction = async (
  id: string,
  transition: Transition,
): Promise<void> => {
  try {
    await adminApiFetch(
      `${API_ROUTES.knowledgeAdmin}/${id}/${transitionPath[transition]}`,
      ArticleSchema,
      {method: 'POST'},
    );
  } catch (error) {
    redirect(`/dashboard/knowledge?error=${encodeURIComponent(describeActionError(error))}`);
  }
  revalidatePath('/dashboard/knowledge');
  revalidatePath(`/dashboard/knowledge/${id}`);
  redirect(`/dashboard/knowledge/${id}`);
};

export const deleteArticleAction = async (id: string): Promise<void> => {
  try {
    await adminApiFetch(`${API_ROUTES.knowledgeAdmin}/${id}`, NoContentSchema, {method: 'DELETE'});
  } catch (error) {
    redirect(`/dashboard/knowledge?error=${encodeURIComponent(describeActionError(error))}`);
  }
  revalidatePath('/dashboard/knowledge');
  redirect('/dashboard/knowledge');
};

const faqInput = (formData: FormData) => ({
  question: text(formData, 'question'),
  answer: text(formData, 'answer'),
  category: text(formData, 'category'),
  sortIndex: Number(text(formData, 'sortIndex') || '0'),
});

export const createFaqAction = async (
  _previous: FormState,
  formData: FormData,
): Promise<FormState> => {
  const parsed = FaqCreateSchema.safeParse({...faqInput(formData), status: 'draft'});
  if (!parsed.success) {
    return {fieldErrors: fieldErrorsOf(parsed.error.issues)};
  }

  let id: string;
  try {
    const created = await adminApiFetch(API_ROUTES.faqAdmin, FaqSchema, {
      method: 'POST',
      body: parsed.data,
    });
    id = created.id;
  } catch (error) {
    return {error: describeActionError(error)};
  }

  revalidatePath('/dashboard/faq');
  redirect(`/dashboard/faq/${id}`);
};

export const updateFaqAction = async (
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> => {
  const parsed = FaqUpdateSchema.safeParse(faqInput(formData));
  if (!parsed.success) {
    return {fieldErrors: fieldErrorsOf(parsed.error.issues)};
  }

  try {
    await adminApiFetch(`${API_ROUTES.faqAdmin}/${id}`, FaqSchema, {
      method: 'PATCH',
      body: parsed.data,
    });
  } catch (error) {
    return {error: describeActionError(error)};
  }

  revalidatePath('/dashboard/faq');
  revalidatePath(`/dashboard/faq/${id}`);
  return {};
};

export const transitionFaqAction = async (id: string, transition: Transition): Promise<void> => {
  try {
    await adminApiFetch(`${API_ROUTES.faqAdmin}/${id}/${transitionPath[transition]}`, FaqSchema, {
      method: 'POST',
    });
  } catch (error) {
    redirect(`/dashboard/faq?error=${encodeURIComponent(describeActionError(error))}`);
  }
  revalidatePath('/dashboard/faq');
  revalidatePath(`/dashboard/faq/${id}`);
  redirect(`/dashboard/faq/${id}`);
};

export const deleteFaqAction = async (id: string): Promise<void> => {
  try {
    await adminApiFetch(`${API_ROUTES.faqAdmin}/${id}`, NoContentSchema, {method: 'DELETE'});
  } catch (error) {
    redirect(`/dashboard/faq?error=${encodeURIComponent(describeActionError(error))}`);
  }
  revalidatePath('/dashboard/faq');
  redirect('/dashboard/faq');
};
