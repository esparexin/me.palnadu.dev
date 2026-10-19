/**
 * Prisma schema parsing and change classification.
 *
 * Prisma's MongoDB connector has no migration history, so nothing in the toolchain
 * tells a reviewer whether a schema change destroys data. This module is the
 * mechanical part of that review: it compares the committed baseline with the
 * intended schema and classifies each difference.
 *
 * Pure functions, no I/O, so the rules can be tested directly rather than inferred
 * from a run. Every entry point fails closed on unusable input: a parser that
 * returns nothing must be an error, never an empty diff that reads as "no change"
 * (the failure mode that made the gate-inventory parser silently vacuous).
 */

const MODEL_START = /^model\s+([A-Za-z0-9_]+)\s*\{/;

/**
 * Extracts models, their fields, and their indexes from a Prisma schema.
 * @returns {{models: Record<string, {fields: Record<string, FieldSpec>, indexes: IndexSpec[]}>, errors: string[]}}
 */
export function parseSchema(source) {
  const errors = [];
  if (typeof source !== 'string' || source.trim().length === 0) {
    return {models: {}, errors: ['schema source is empty or not a string']};
  }

  const lines = source.split('\n');
  const models = {};
  let current = null;
  let depth = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\/\/.*$/, '').trim();
    if (line.length === 0) continue;

    if (current === null) {
      const match = MODEL_START.exec(line);
      if (match) {
        current = match[1];
        models[current] = {fields: {}, indexes: []};
        depth = line.includes('{') ? 1 : 0;
      }
      continue;
    }

    if (line.startsWith('}')) {
      depth -= 1;
      if (depth <= 0) current = null;
      continue;
    }

    if (line.startsWith('@@index') || line.startsWith('@@unique')) {
      const unique = line.startsWith('@@unique');
      const fields = extractIndexFields(line);
      if (fields.length === 0) {
        errors.push(`model ${current}: could not parse index definition "${line}"`);
      }
      models[current].indexes.push({fields, unique});
      continue;
    }

    const field = parseField(line);
    if (field !== null) models[current].fields[field.name] = field;
  }

  if (Object.keys(models).length === 0) {
    errors.push('no models were parsed from the schema; refusing to report "no changes"');
  }

  return {models, errors};
}

/**
 * @typedef {{name: string, type: string, required: boolean, unique: boolean,
 *            hasDefault: boolean, updatedAt: boolean, indexed: boolean}} FieldSpec
 * @typedef {{fields: string[], unique: boolean}} IndexSpec
 */
function parseField(line) {
  const match = /^([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)(\[\])?(\?)?(.*)$/.exec(line);
  if (match === null) return null;

  const [, name, type, isList, optional, rest = ''] = match;
  // Attribute-only lines such as `@@id([a, b])` are handled before this point;
  // a bare attribute line cannot be a field because it never has a type.
  if (type === '' || name.startsWith('@')) return null;

  return {
    name,
    type: `${type}${isList ?? ''}`,
    required: optional !== '?',
    unique: /@unique\b/.test(rest),
    hasDefault: /@default\b/.test(rest),
    updatedAt: /@updatedAt\b/.test(rest),
    indexed: /@unique\b/.test(rest),
  };
}

function extractIndexFields(line) {
  // The argument is a bracketed list: `@@index([a, b])`. Matching on the bracket
  // explicitly avoids the earlier bug where `\(([^)]*)\)` swallowed the brackets,
  // because `]` is not `)` and so was captured into the field names.
  const bracketed = /\(\s*\[([^\]]*)\]\s*\)/.exec(line);
  const inner =
    bracketed !== null ? bracketed[1] : (/^\s*@@\w+\s*\(\s*([^)]*)\s*\)/.exec(line) ?? [])[1];
  if (typeof inner !== 'string') return [];
  return inner
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Compares a baseline schema with an intended schema.
 *
 * @returns {{changes: Change[], errors: string[], summary: {destructive: number, risky: number, safe: number}}}
 * @typedef {{kind: string, target: string, classification: 'destructive'|'risky'|'safe', detail: string}} Change
 */
export function diffSchemas(baseline, intended) {
  const errors = [...baseline.errors, ...intended.errors];

  const baseModels = Object.keys(baseline.models).sort();
  const nextModels = Object.keys(intended.models).sort();
  if (baseModels.length === 0) errors.push('baseline contains no models');
  if (nextModels.length === 0) errors.push('intended schema contains no models');

  const changes = [];
  const addedModels = nextModels.filter((name) => !baseModels.includes(name));
  const removedModels = baseModels.filter((name) => !nextModels.includes(name));

  for (const name of removedModels) {
    changes.push({
      kind: 'model-removed',
      target: name,
      classification: 'destructive',
      detail: 'model removed: every document in this collection becomes unreachable',
    });
  }
  for (const name of addedModels) {
    changes.push({
      kind: 'model-added',
      target: name,
      classification: 'safe',
      detail: 'new model with no existing data',
    });
  }

  for (const name of baseModels.filter((model) => nextModels.includes(model))) {
    changes.push(...diffModel(name, baseline.models[name], intended.models[name]));
  }

  const summary = {
    destructive: changes.filter((change) => change.classification === 'destructive').length,
    risky: changes.filter((change) => change.classification === 'risky').length,
    safe: changes.filter((change) => change.classification === 'safe').length,
  };

  return {changes, errors, summary};
}

function diffModel(name, before, after) {
  const changes = [];
  const beforeFields = Object.keys(before.fields).sort();
  const afterFields = Object.keys(after.fields).sort();

  for (const field of beforeFields.filter((key) => !afterFields.includes(key))) {
    changes.push({
      kind: 'field-removed',
      target: `${name}.${field}`,
      classification: 'destructive',
      detail: 'field removed: its stored values are lost and cannot be restored by reverting code',
    });
  }

  for (const field of afterFields.filter((key) => !beforeFields.includes(key))) {
    const spec = after.fields[field];
    const classification =
      spec.required && !spec.hasDefault && !spec.updatedAt ? 'destructive' : 'safe';
    changes.push({
      kind: 'field-added',
      target: `${name}.${field}`,
      classification,
      detail:
        classification === 'destructive'
          ? 'required field with no default: existing documents would fail validation and writes would break'
          : 'field added with a default or as optional: existing documents remain valid',
    });
  }

  for (const field of beforeFields.filter((key) => afterFields.includes(key))) {
    const previous = before.fields[field];
    const next = after.fields[field];

    if (previous.type !== next.type) {
      changes.push({
        kind: 'field-type-changed',
        target: `${name}.${field}`,
        classification: 'destructive',
        detail: `type changed ${previous.type} -> ${next.type}: stored values are not reinterpretable`,
      });
    }
    if (previous.required && !next.required) {
      changes.push({
        kind: 'field-made-optional',
        target: `${name}.${field}`,
        classification: 'safe',
        detail: 'field became optional: existing documents remain readable',
      });
    }
    if (!previous.required && next.required && !next.hasDefault) {
      changes.push({
        kind: 'field-made-required',
        target: `${name}.${field}`,
        classification: 'destructive',
        detail: 'field became required with no default: existing documents would become invalid',
      });
    }
    if (previous.unique && !next.unique) {
      changes.push({
        kind: 'unique-removed',
        target: `${name}.${field}`,
        classification: 'destructive',
        detail:
          'unique constraint removed: duplicate values can now be written, and nothing prevents them',
      });
    }
    if (!previous.unique && next.unique) {
      changes.push({
        kind: 'unique-added',
        target: `${name}.${field}`,
        classification: 'destructive',
        detail:
          'unique constraint added: existing duplicate values would make the index creation fail',
      });
    }
  }

  changes.push(...diffIndexes(name, before.indexes, after.indexes));
  return changes;
}

function indexKey(index) {
  return `${index.fields.join(',')}${index.unique ? ':unique' : ''}`;
}

function diffIndexes(name, before, after) {
  const changes = [];
  const beforeKeys = new Set(before.map(indexKey));
  const afterKeys = new Set(after.map(indexKey));

  for (const index of before) {
    if (afterKeys.has(indexKey(index))) continue;
    changes.push({
      kind: index.unique ? 'unique-index-removed' : 'index-removed',
      target: `${name}.@@${index.unique ? 'unique' : 'index'}(${index.fields.join(',')})`,
      classification: index.unique ? 'destructive' : 'risky',
      detail: index.unique
        ? 'unique index removed: an integrity guarantee is lost'
        : 'query index removed: no data is lost, but a public query may lose its supporting index',
    });
  }
  for (const index of after) {
    if (beforeKeys.has(indexKey(index))) continue;
    changes.push({
      kind: index.unique ? 'unique-index-added' : 'index-added',
      target: `${name}.@@${index.unique ? 'unique' : 'index'}(${index.fields.join(',')})`,
      classification: index.unique ? 'risky' : 'safe',
      detail: index.unique
        ? 'unique index added: existing duplicate values would make the change fail, so run it against a copy first'
        : 'query index added',
    });
  }

  return changes;
}

/** Changes that block a merge unless an explicit, reviewed exception exists. */
export const destructiveChanges = (diff) =>
  diff.changes.filter((change) => change.classification === 'destructive');

/**
 * Compares the destructive changes against reviewed exceptions.
 * An exception only counts when it names an exact target and carries a recovery
 * plan, so "we did it anyway" cannot be expressed as a one-word allowance.
 */
export function evaluateExceptions(destructive, exceptions) {
  const unmatched = [];
  for (const change of destructive) {
    const match = (exceptions ?? []).find(
      (exception) =>
        exception.target === change.target &&
        typeof exception.recovery === 'string' &&
        exception.recovery.trim().length > 0,
    );
    if (match === undefined) unmatched.push(change);
  }
  return unmatched;
}
