import {type Prisma} from '@prisma/client';
import {ApiError} from './api-error.js';

/**
 * Mapping from Prisma failures to contract error codes.
 *
 * The rule is deliberately asymmetric: a *known* Prisma error becomes a precise,
 * client-safe contract code, while an unknown error becomes an opaque
 * INTERNAL_ERROR. Driver messages, collection names, and connection strings are
 * never returned to a client (SECURITY.md section 5); they are logged once, here,
 * with a request id so an operator can correlate them.
 */

type KnownError = {code: string; meta?: Record<string, unknown>};

const isKnownPrismaError = (error: unknown): error is KnownError =>
  typeof error === 'object' &&
  error !== null &&
  typeof (error as {code?: unknown}).code === 'string' &&
  (error as {code: string}).code.startsWith('P');

const uniqueTargetFields = (meta: Record<string, unknown> | undefined): string[] => {
  const target = meta?.['target'];
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === 'string') return [target];
  return [];
};

export interface MappedError {
  error: ApiError;
  /** Safe to log; never returned to the client. */
  logDetail: string;
}

export const mapPersistenceError = (error: unknown): MappedError => {
  if (error instanceof ApiError) {
    return {error, logDetail: `${error.code}: ${error.message}`};
  }

  if (!isKnownPrismaError(error)) {
    return {
      error: ApiError.internal(),
      logDetail: `unmapped persistence failure: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  switch (error.code) {
    case 'P2002': {
      const fields = uniqueTargetFields(error.meta);
      const where = fields.length > 0 ? fields.join(', ') : 'a unique field';
      return {
        error: ApiError.conflict(`A record with this ${where} already exists.`),
        logDetail: `unique constraint violated on ${where}`,
      };
    }
    case 'P2025':
    case 'P2018':
      return {
        error: ApiError.notFound('The requested record does not exist.'),
        logDetail: `record not found (${error.code})`,
      };
    case 'P1001':
    case 'P1002':
      return {
        error: ApiError.internal('The data store is unavailable.'),
        logDetail: `cannot reach the database (${error.code})`,
      };
    case 'P1008':
      return {
        error: ApiError.internal('The data store timed out.'),
        logDetail: `database operation timed out (${error.code})`,
      };
    case 'P2024':
      return {
        error: ApiError.internal('The data store timed out.'),
        logDetail: 'connection pool timed out',
      };
    default:
      return {
        error: ApiError.internal(),
        logDetail: `unmapped prisma error ${error.code}: ${JSON.stringify(error.meta ?? {})}`,
      };
  }
};

/**
 * Re-exported so callers can type a caught error without importing Prisma into
 * application code that does not otherwise need it.
 */
export type {Prisma};
