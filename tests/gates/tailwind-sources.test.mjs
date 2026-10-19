import {existsSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

/**
 * Tailwind source coverage for shared UI primitives.
 *
 * Tailwind v4 scans the application directory only. Utilities used exclusively
 * inside `packages/ui` primitives are therefore purged from a production build
 * unless the application stylesheet declares them as a source. The failure is
 * invisible to unit tests (jsdom has no stylesheet) and to axe (spacing and
 * minimum control size are not contrast failures), so nothing else in the gate
 * set would catch the regression: the primitives ship unstyled to production.
 *
 * The directive is the contract; the e2e assertion in
 * `tests/e2e/public-site.spec.ts` proves a rendered control actually receives it.
 */

const ROOT = new URL('../..', import.meta.url).pathname;
const APPS = ['apps/web', 'apps/admin'];
const UI_SOURCE = join('packages', 'ui', 'src');

const sourceDirectives = (css) =>
  [...css.matchAll(/@source\s+['"]([^'"]+)['"]/g)].map((match) => match[1] ?? '');

describe('tailwind sources', () => {
  for (const app of APPS) {
    it(`${app} scans packages/ui`, () => {
      const stylesheet = join(ROOT, app, 'src', 'app', 'globals.css');
      expect(existsSync(stylesheet), `${stylesheet} exists`).toBe(true);

      const directives = sourceDirectives(readFileSync(stylesheet, 'utf8'));
      const resolved = directives.map((directive) =>
        resolve(join(ROOT, app, 'src', 'app'), directive),
      );

      const uiSource = resolve(ROOT, UI_SOURCE);
      expect(
        resolved.includes(uiSource),
        `${app}/src/app/globals.css must declare @source for ${UI_SOURCE}`,
      ).toBe(true);
    });
  }
});
