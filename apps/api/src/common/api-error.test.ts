import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {ApiErrorEnvelopeSchema, ERROR_CODES} from '@me-palnadu/contracts';
import {ApiError, statusForErrorCode} from './api-error.js';
import {buildEnvelope} from './api-exception.filter.js';
import {mapPersistenceError} from './persistence-error.js';
import {ZodValidationPipe} from './zod-validation.pipe.js';

describe('ApiError', () => {
  it('derives its HTTP status from the contract error code', () => {
    // A code with no status entry would produce an undefined status and a
    // framework default of 200, which is precisely the false-green shape to avoid.
    for (const code of ERROR_CODES) {
      expect(statusForErrorCode(code), `status for ${code}`).toBeGreaterThanOrEqual(400);
    }
  });

  it('produces an envelope that satisfies the published contract', () => {
    const envelope = buildEnvelope(ApiError.notFound('nothing here'), 'req-1');
    expect(ApiErrorEnvelopeSchema.safeParse(envelope).success).toBe(true);
    expect(envelope.error.code).toBe('NOT_FOUND');
    expect(envelope.error.requestId).toBe('req-1');
  });

  it('omits details when there are none rather than sending an empty array', () => {
    const envelope = buildEnvelope(ApiError.badRequest('nope'), 'req-2');
    expect(envelope.error).not.toHaveProperty('details');
  });

  it('carries validation details when present', () => {
    const envelope = buildEnvelope(
      ApiError.validationFailed('invalid', [{path: 'startDate', message: 'must be YYYY-MM'}]),
      'req-3',
    );
    expect(envelope.error.details).toEqual([{path: 'startDate', message: 'must be YYYY-MM'}]);
  });
});

describe('persistence error mapping', () => {
  it('maps a unique-constraint violation to CONFLICT and names the field', () => {
    const {error} = mapPersistenceError({code: 'P2002', meta: {target: ['slug']}});
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toContain('slug');
  });

  it('maps a missing record to NOT_FOUND', () => {
    expect(mapPersistenceError({code: 'P2025'}).error.code).toBe('NOT_FOUND');
    expect(mapPersistenceError({code: 'P2018'}).error.code).toBe('NOT_FOUND');
  });

  it('maps an unreachable database to INTERNAL_ERROR with a safe message', () => {
    const mapped = mapPersistenceError({code: 'P1001'});
    expect(mapped.error.code).toBe('INTERNAL_ERROR');
    expect(mapped.error.message).toBe('The data store is unavailable.');
    expect(mapped.error.message).not.toMatch(/P1001|prisma/i);
  });

  it('never forwards driver text for an unmapped failure', () => {
    const mapped = mapPersistenceError(new Error('mongodb://user:hunter2@host/db timed out'));
    expect(mapped.error.message).toBe('Internal server error');
    expect(mapped.logMessage).toContain('hunter2');
  });

  it('passes an ApiError through unchanged', () => {
    const original = ApiError.conflict('already exists');
    expect(mapPersistenceError(original).error).toBe(original);
  });

  it('treats a non-Prisma failure as internal rather than assuming a code', () => {
    expect(mapPersistenceError('a string').error.code).toBe('INTERNAL_ERROR');
    expect(mapPersistenceError(null).error.code).toBe('INTERNAL_ERROR');
    expect(mapPersistenceError({code: 'NOT_A_PRISMA_CODE'}).error.code).toBe('INTERNAL_ERROR');
  });
});

describe('ZodValidationPipe', () => {
  const schema = z.object({title: z.string().min(1), count: z.number().int()});

  it('returns parsed output for valid input', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({title: 'ok', count: 1}, {})).toEqual({title: 'ok', count: 1});
  });

  it('throws VALIDATION_FAILED with a path per issue', () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({title: '', count: 1.5}, {});
      expect.unreachable('the pipe should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('VALIDATION_FAILED');
      expect((error as ApiError).details?.length).toBeGreaterThan(0);
      expect((error as ApiError).details?.map((detail) => detail.path)).toContain('title');
    }
  });

  it('strips unknown keys rather than forwarding them to persistence', () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({title: 'ok', count: 1, isAdmin: true}, {});
    expect(result).not.toHaveProperty('isAdmin');
  });

  it('reports the root path for a whole-body failure', () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform('not an object', {});
      expect.unreachable('the pipe should have thrown');
    } catch (error) {
      expect((error as ApiError).details?.[0]?.path).toBe('(root)');
    }
  });
});
