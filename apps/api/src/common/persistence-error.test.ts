import {describe, expect, it} from 'vitest';
import {mapPersistenceError} from './persistence-error.js';
import {ApiError} from './api-error.js';

describe('mapPersistenceError', () => {
  it('passes through an existing ApiError unchanged', () => {
    const existing = ApiError.notFound('Already an API error');
    const {error, logDetail} = mapPersistenceError(existing);
    expect(error).toBe(existing);
    expect(logDetail).toBe('NOT_FOUND: Already an API error');
  });

  it('maps an unknown persistence failure to an opaque INTERNAL_ERROR', () => {
    const {error, logDetail} = mapPersistenceError(
      new Error('mongodb://user:placeholder@127.0.0.1:27017/db failed'),
    );
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('Internal server error');
    expect(logDetail).toContain('unmapped');
    expect(error.message).not.toContain('mongodb://');
  });

  it('maps a unique-constraint violation to a CONFLICT without driver text', () => {
    const {error, logDetail} = mapPersistenceError({code: 'P2002', meta: {target: ['slug']}});
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toContain('slug');
    expect(error.message).not.toMatch(/P2002|prisma/i);
    expect(logDetail).toContain('unique constraint');
  });

  it('maps a record-not-found violation to NOT_FOUND', () => {
    const {error, logDetail} = mapPersistenceError({code: 'P2025'});
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('The requested record does not exist.');
    expect(logDetail).toContain('record not found');
  });

  it('maps an unreachable database to an opaque INTERNAL_ERROR', () => {
    const {error, logDetail} = mapPersistenceError({code: 'P1001'});
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('The data store is unavailable.');
    expect(logDetail).toContain('cannot reach the database');
  });

  it('maps a database timeout to an opaque INTERNAL_ERROR', () => {
    const {error, logDetail} = mapPersistenceError({code: 'P1008'});
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('The data store timed out.');
    expect(logDetail).toContain('timed out');
  });
});
