'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {
  API_ROUTES,
  NoContentSchema,
  MediaAssetSchema,
  MediaRegisterSchema,
  MediaSignResponseSchema,
  type MediaRegisterInput,
  type MediaResourceType,
} from '@me-palnadu/contracts';
import {adminApiFetch, describeActionError} from './api';

/**
 * Media server actions.
 *
 * The browser never sees `CLOUDINARY_API_SECRET`: it receives a signature bound to
 * a timestamp and this deployment's folder, uploads the bytes directly to the
 * provider, then asks the API to register the resulting metadata (ADR-0010 §4).
 */

export type ActionResult<Data> = {ok: true; data: Data} | {ok: false; error: string};

export const requestMediaSignature = async (
  resourceType: MediaResourceType,
): Promise<ActionResult<ReturnType<typeof MediaSignResponseSchema.parse>>> => {
  try {
    const data = await adminApiFetch(`${API_ROUTES.media}/sign`, MediaSignResponseSchema, {
      method: 'POST',
      body: {resourceType},
    });
    return {ok: true, data};
  } catch (error) {
    return {ok: false, error: describeActionError(error)};
  }
};

export const registerMediaAction = async (
  input: MediaRegisterInput,
): Promise<ActionResult<{id: string}>> => {
  const parsed = MediaRegisterSchema.safeParse(input);
  if (!parsed.success) {
    return {ok: false, error: parsed.error.issues[0]?.message ?? 'The asset metadata is invalid.'};
  }

  try {
    const asset = await adminApiFetch(API_ROUTES.media, MediaAssetSchema, {
      method: 'POST',
      body: parsed.data,
    });
    revalidatePath('/dashboard/media');
    return {ok: true, data: {id: asset.id}};
  } catch (error) {
    return {ok: false, error: describeActionError(error)};
  }
};

export const deleteMediaAction = async (id: string): Promise<void> => {
  try {
    await adminApiFetch(`${API_ROUTES.media}/${id}`, NoContentSchema, {method: 'DELETE'});
  } catch (error) {
    redirect(`/dashboard/media?error=${encodeURIComponent(describeActionError(error))}`);
  }
  revalidatePath('/dashboard/media');
  redirect('/dashboard/media');
};
