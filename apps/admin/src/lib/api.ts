import {ApiErrorEnvelopeSchema} from '@me-palnadu/contracts';
import {getSessionToken} from './session';

/**
 * The admin app's only path to the API (ARCHITECTURE.md §3: apps integrate over
 * HTTP, never by importing `apps/api`).
 *
 * Every response is parsed with the contract schema that describes it. A page
 * therefore cannot render a shape the contract does not allow, and a server action
 * cannot silently treat an error envelope as data.
 */
export class AdminApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

const apiBase = (): string => process.env['ADMIN_API_URL'] ?? 'http://localhost:4000';

export interface AdminFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

/**
 * The slice of a schema this client needs. Structural rather than a Zod import:
 * the admin bundle should not carry a validator runtime it never calls directly.
 */
interface ResponseSchema<Value> {
  safeParse: (value: unknown) => {success: true; data: Value} | {success: false};
}

export const adminApiFetch = async <Value>(
  path: string,
  schema: ResponseSchema<Value>,
  options: AdminFetchOptions = {},
): Promise<Value> => {
  const token = await getSessionToken();
  if (token === null) {
    throw new AdminApiError('UNAUTHENTICATED', 'Your session has expired. Sign in again.', 401);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body === undefined ? {} : {'Content-Type': 'application/json'}),
      },
      ...(options.body === undefined ? {} : {body: JSON.stringify(options.body)}),
      cache: 'no-store',
    });
  } catch {
    throw new AdminApiError(
      'DEPENDENCY_UNAVAILABLE',
      'The API is unreachable. Check that it is running.',
      503,
    );
  }

  if (response.status === 204) {
    const empty = schema.safeParse(undefined);
    if (!empty.success) {
      throw new AdminApiError('INTERNAL_ERROR', 'Expected an empty response.', response.status);
    }
    return empty.data;
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = ApiErrorEnvelopeSchema.safeParse(body);
    if (parsed.success) {
      throw new AdminApiError(parsed.data.error.code, parsed.data.error.message, response.status);
    }
    throw new AdminApiError(
      'INTERNAL_ERROR',
      'The API returned an unexpected response.',
      response.status,
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AdminApiError(
      'INTERNAL_ERROR',
      'The API response did not match the published contract.',
      response.status,
    );
  }
  return parsed.data;
};

/** Converts an action failure into a message a page can display. */
export const describeActionError = (error: unknown): string => {
  if (error instanceof AdminApiError) {
    if (error.code === 'UNAUTHENTICATED') {
      return 'Your session has expired. Sign in again.';
    }
    return error.message;
  }
  return 'The change could not be saved. Try again.';
};
