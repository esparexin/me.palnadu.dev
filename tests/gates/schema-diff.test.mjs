import {describe, expect, it} from 'vitest';
import {
  destructiveChanges,
  diffSchemas,
  evaluateExceptions,
  parseSchema,
} from '../../scripts/lib/schema-diff.mjs';

/**
 * Regression tests for the schema-change classifier.
 *
 * The MongoDB connector has no migration history, so this classifier is the only
 * mechanical signal a reviewer gets about data loss. Its behaviour on *unusable*
 * input matters as much as its behaviour on real changes: a parser that silently
 * returns nothing would report "no destructive changes" for every schema, which is
 * the false green this repository already had to fix once.
 */

const parse = (source) => parseSchema(source);
const diff = (before, after) => diffSchemas(parse(before), parse(after));

const BASE = `
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

model Experience {
  id          String    @id @default(auto()) @map("_id") @db.ObjectId
  slug        String    @unique
  org         String
  title       String
  location    String?
  startDate   String
  current     Boolean   @default(false)
  sortIndex   Int       @default(0)
  published   Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([published, startDate])
}
`;

/** Inserts a line inside the model block, immediately before its closing brace. */
const withField = (line, source = BASE) => source.replace(/\n}\s*$/, `\n${line}\n}\n`);
/** Inserts an attribute block inside the model, immediately before its closing brace. */
const withBlock = (line, source = BASE) => source.replace(/\n}\s*$/, `\n${line}\n}\n`);

describe('parseSchema fails closed', () => {
  it('rejects an empty source rather than reporting no models', () => {
    const result = parse('');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(Object.keys(result.models)).toEqual([]);
  });

  it('rejects a non-string source', () => {
    expect(parse(undefined).errors.length).toBeGreaterThan(0);
    expect(parse(null).errors.length).toBeGreaterThan(0);
  });

  it('rejects a schema with no models', () => {
    const result = parse('datasource db {\n  provider = "mongodb"\n}\n');
    expect(result.errors.join(' ')).toMatch(/no models/i);
  });

  it('parses fields, list types, optionality, and indexes', () => {
    const {models, errors} = parse(`
model Sample {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  required  String
  optional  String?
  many      String[] @default([])
  updatedAt DateTime @updatedAt

  @@index([optional, required])
  @@unique([required])
}
`);
    expect(errors).toEqual([]);
    expect(models.Sample.fields['required'].required).toBe(true);
    expect(models.Sample.fields['optional'].required).toBe(false);
    expect(models.Sample.fields['many'].type).toBe('String[]');
    expect(models.Sample.fields['updatedAt'].updatedAt).toBe(true);
    expect(models.Sample.indexes).toEqual([
      {fields: ['optional', 'required'], unique: false},
      {fields: ['required'], unique: true},
    ]);
  });
});

describe('diffSchemas classifies changes', () => {
  it('reports no changes for an identical schema', () => {
    const result = diff(BASE, BASE);
    expect(result.changes).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.summary.destructive).toBe(0);
  });

  it('detects a removed model as destructive', () => {
    const result = diff(
      BASE,
      'datasource db {\n  provider = "mongodb"\n}\nmodel Other {\n  id String @id\n}\n',
    );
    const change = result.changes.find((entry) => entry.kind === 'model-removed');
    expect(change?.target).toBe('Experience');
    expect(change?.classification).toBe('destructive');
  });

  it('detects a removed field as destructive', () => {
    const result = diff(BASE, BASE.replace('  org         String\n', ''));
    const change = result.changes.find((entry) => entry.kind === 'field-removed');
    expect(change?.target).toBe('Experience.org');
    expect(change?.classification).toBe('destructive');
  });

  it('detects a type change as destructive', () => {
    const result = diff(
      BASE,
      BASE.replace('  sortIndex   Int       @default(0)', '  sortIndex   Float     @default(0)'),
    );
    const change = result.changes.find((entry) => entry.kind === 'field-type-changed');
    expect(change?.target).toBe('Experience.sortIndex');
    expect(change?.classification).toBe('destructive');
  });

  it('treats a renamed field as a removal plus an addition, both flagged', () => {
    const result = diff(BASE, BASE.replace('  title       String', '  headline    String'));
    expect(result.changes.some((entry) => entry.kind === 'field-removed')).toBe(true);
    // The replacement is required with no default, so it is also destructive.
    expect(
      result.changes.some(
        (entry) => entry.kind === 'field-added' && entry.classification === 'destructive',
      ),
    ).toBe(true);
  });

  it('treats a required field with no default as destructive', () => {
    const result = diff(BASE, withField('  region  String'));
    const change = result.changes.find((entry) => entry.kind === 'field-added');
    expect(change?.classification).toBe('destructive');
  });

  it('treats an added field with a default as safe', () => {
    const result = diff(
      BASE,
      BASE.replace(
        '  published   Boolean   @default(false)',
        '  published   Boolean   @default(false)\n  featured    Boolean   @default(false)',
      ),
    );
    const change = result.changes.find((entry) => entry.kind === 'field-added');
    expect(change?.classification).toBe('safe');
  });

  it('treats an added optional field as safe', () => {
    const result = diff(BASE, withField('  region  String?'));
    expect(result.changes.find((entry) => entry.kind === 'field-added')?.classification).toBe(
      'safe',
    );
  });

  it('detects a removed unique constraint as destructive', () => {
    const result = diff(
      BASE,
      BASE.replace('  slug        String    @unique', '  slug        String'),
    );
    const change = result.changes.find((entry) => entry.kind === 'unique-removed');
    expect(change?.target).toBe('Experience.slug');
    expect(change?.classification).toBe('destructive');
  });

  it('treats a removed query index as risky rather than destructive', () => {
    const result = diff(BASE, BASE.replace('\n  @@index([published, startDate])\n', '\n'));
    const change = result.changes.find((entry) => entry.kind === 'index-removed');
    expect(change?.classification).toBe('risky');
  });

  it('treats a removed @@unique block as destructive', () => {
    const withUnique = withBlock('  @@unique([org, title])');
    const result = diff(withUnique, BASE);
    const change = result.changes.find((entry) => entry.kind === 'unique-index-removed');
    expect(change?.classification).toBe('destructive');
  });

  it('does not confuse @@unique with @@index when parsing', () => {
    const {models} = parse(withBlock('  @@unique([org, title])'));
    expect(models.Experience.indexes).toEqual(
      expect.arrayContaining([{fields: ['published', 'startDate'], unique: false}]),
    );
    expect(models.Experience.indexes).toContainEqual({fields: ['org', 'title'], unique: true});
  });

  it('surfaces parser errors rather than hiding them in the diff', () => {
    const result = diffSchemas({models: {}, errors: ['baseline is empty']}, parse(BASE));
    expect(result.errors).toContain('baseline is empty');
    expect(result.errors.join(' ')).toMatch(/baseline contains no models/);
  });
});

describe('exception handling', () => {
  const destructive = [
    {kind: 'field-removed', target: 'Experience.org', classification: 'destructive', detail: ''},
  ];

  it('blocks when no exception is recorded', () => {
    expect(evaluateExceptions(destructive, [])).toHaveLength(1);
  });

  it('blocks when an exception has no recovery plan', () => {
    const result = evaluateExceptions(destructive, [{target: 'Experience.org', recovery: '  '}]);
    expect(result).toHaveLength(1);
  });

  it('blocks when an exception targets a different change', () => {
    const result = evaluateExceptions(destructive, [
      {target: 'Experience.other', recovery: 'restore from backup'},
    ]);
    expect(result).toHaveLength(1);
  });

  it('allows an exception that names the exact target and a recovery plan', () => {
    const result = evaluateExceptions(destructive, [
      {
        target: 'Experience.org',
        recovery: 'Atlas point-in-time restore to 2026-10-19T00:00Z, verified in staging',
      },
    ]);
    expect(result).toEqual([]);
  });

  it('extracts only the destructive changes', () => {
    const changes = [
      {classification: 'safe'},
      {classification: 'risky'},
      {classification: 'destructive'},
    ];
    expect(destructiveChanges({changes})).toEqual([{classification: 'destructive'}]);
  });
});
