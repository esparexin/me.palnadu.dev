import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

/**
 * Automated accessibility gate (CI_GATES.md area 4, TESTING.md section 7).
 *
 * Zero serious or critical violations on every public route. This is a floor,
 * not the whole accessibility review: automated checks cannot judge whether a
 * focus order makes sense, and the Manual Verification Gate covers that.
 */

const ROUTES = ['/', '/experience', '/projects', '/knowledge', '/resume', '/contact'];

for (const route of ROUTES) {
  test(`${route} has no serious or critical accessibility violations`, async ({page}) => {
    await page.goto(route);

    const results = await new AxeBuilder({page})
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const blocking = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );

    expect(
      blocking.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node) => node.target),
      })),
      `blocking violations on ${route}`,
    ).toEqual([]);
  });
}

test('every route exposes exactly one h1 and a main landmark', async ({page}) => {
  for (const route of ROUTES) {
    await page.goto(route);
    await expect(page.locator('h1'), `${route} must have one h1`).toHaveCount(1);
    await expect(page.getByRole('main'), `${route} must expose a main landmark`).toHaveCount(1);
  }
});
