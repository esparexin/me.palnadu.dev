import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BREAKPOINTS,
  COLOR_TOKENS,
  FLOATING_MENU_BREAKPOINT,
  LAYOUT_TOKENS,
  MOTION_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  SPACING_SCALE,
  TYPOGRAPHY_TOKENS,
  Z_INDEX_TOKENS,
} from './index.js';

/**
 * The CSS and TypeScript representations of the tokens must agree. A token added
 * to one and forgotten in the other is exactly the duplication SSOT_POLICY.md
 * forbids, so the mismatch fails the build rather than waiting for review.
 */
const css = readFileSync(path.join(import.meta.dirname, 'theme.css'), 'utf8');

// Sub-properties such as `--text-display--line-height` must not be read as a
// token named "display--line-height", so the name pattern forbids a double hyphen.
const cssVariables = (prefix: string): string[] =>
  [...css.matchAll(new RegExp(`--${prefix}-([a-z0-9]+(?:-[a-z0-9]+)*)\\s*:`, 'g'))].map((m) => m[1]);

describe('token parity between theme.css and the runtime mirror', () => {
  it('exposes exactly the same colour tokens in both representations', () => {
    expect(new Set(cssVariables('color'))).toEqual(new Set(Object.keys(COLOR_TOKENS)));
  });

  it('exposes exactly the same radius tokens', () => {
    expect(new Set(cssVariables('radius'))).toEqual(new Set(Object.keys(RADIUS_TOKENS)));
  });

  it('exposes exactly the same elevation tokens', () => {
    expect(new Set(cssVariables('shadow'))).toEqual(new Set(Object.keys(SHADOW_TOKENS)));
  });

  it('exposes exactly the same breakpoints', () => {
    expect(new Set(cssVariables('breakpoint'))).toEqual(new Set(Object.keys(BREAKPOINTS)));
  });

  it('exposes exactly the same typography steps', () => {
    expect(new Set(cssVariables('text'))).toEqual(new Set(Object.keys(TYPOGRAPHY_TOKENS)));
  });

  it('exposes exactly the same spacing steps', () => {
    expect(new Set(cssVariables('spacing'))).toEqual(new Set(SPACING_SCALE));
  });

  it('uses fluid clamps for the large type steps', () => {
    for (const token of ['display', 'h1', 'h2', 'lead']) {
      const declaration = new RegExp(`--text-${token}:\\s*([^;]+);`).exec(css);
      expect(declaration?.[1]?.trim().startsWith('clamp('), `${token} must use clamp()`).toBe(true);
    }
  });

  it('exposes exactly the same z-index steps', () => {
    expect(new Set(cssVariables('z-index'))).toEqual(new Set(Object.keys(Z_INDEX_TOKENS)));
  });
});

describe('token invariants', () => {
  it('keeps the floating menu below the desktop navigation breakpoint', () => {
    expect(FLOATING_MENU_BREAKPOINT).toBe(BREAKPOINTS.lg);
  });

  it('orders the z-index scale without collisions', () => {
    const values = Object.values(Z_INDEX_TOKENS);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it('keeps the page container wider than the prose measure', () => {
    expect(LAYOUT_TOKENS.page).not.toBe(LAYOUT_TOKENS.measure);
    expect(Number.parseInt(LAYOUT_TOKENS.page, 10)).toBeGreaterThan(
      Number.parseInt(LAYOUT_TOKENS.measure, 10),
    );
  });

  it('keeps motion durations within the documented ceiling', () => {
    const ms = (token: string) => Number.parseInt(MOTION_TOKENS[token as keyof typeof MOTION_TOKENS], 10);
    expect(ms('duration-fast')).toBeLessThanOrEqual(ms('duration-base'));
    expect(ms('duration-base')).toBeLessThanOrEqual(ms('duration-slow'));
    expect(ms('duration-slow')).toBeLessThanOrEqual(320);
  });

  it('starts the type scale at the accessibility floor', () => {
    // UI_UX_STANDARDS 2.2: 12px is permitted only for the uppercase eyebrow
    // label; meta is the floor for body-adjacent text and body copy is larger.
    const sizes = Object.entries(TYPOGRAPHY_TOKENS).map(
      ([name, step]) => [name, Number.parseFloat(step.size) * 16] as const,
    );
    const smallest = Math.min(...sizes.map(([, px]) => px));
    expect(smallest).toBeGreaterThanOrEqual(12);
    expect(sizes.find(([, px]) => px === smallest)?.[0]).toBe('eyebrow');
    expect(TYPOGRAPHY_TOKENS.meta.size).toBe('0.8125rem');
    expect(TYPOGRAPHY_TOKENS.body.size).toBe('1.0625rem');
  });

  it('defines no token outside UI_UX_STANDARDS section 2', () => {
    const allowedColors = new Set([
      'surface', 'surface-subtle', 'surface-muted', 'text-primary', 'text-secondary',
      'text-tertiary', 'text-inverse', 'accent', 'accent-hover', 'accent-subtle',
      'border-default', 'border-subtle', 'focus', 'success', 'warning', 'danger', 'info',
      'accent-text',
    ]);
    for (const token of Object.keys(COLOR_TOKENS)) {
      expect(allowedColors.has(token)).toBe(true);
    }
  });
});