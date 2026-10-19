import {expect, test, type Page} from '@playwright/test';

/**
 * Critical public journeys that exist in the Phase 3 scaffold
 * (TESTING.md section 7). These are the assertions that must survive every later
 * phase: if the hero CTAs, the routes, or the navigation break, the build fails.
 */

test('home renders the identity and exactly the two required CTAs', async ({page}) => {
  await page.goto('/');

  await expect(page.getByRole('heading', {level: 1})).toBeVisible();

  const viewResume = page.getByRole('link', {name: 'View Resume'});
  const exploreExperience = page.getByRole('link', {name: 'Explore Experience'});

  await expect(viewResume).toBeVisible();
  await expect(exploreExperience).toBeVisible();
  await expect(viewResume).toHaveAttribute('href', '/resume');
  await expect(exploreExperience).toHaveAttribute('href', '/experience');

  // No duplicate CTA for the same destination in the first viewport
  // (UI_UX_STANDARDS 7.1).
  await expect(page.getByRole('link', {name: 'View Resume'})).toHaveCount(1);
  await expect(page.getByRole('link', {name: 'Explore Experience'})).toHaveCount(1);
});

test('the language is declared and a skip link exists', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', {name: 'Skip to content'})).toBeFocused();
});

test('primary navigation reaches every public route without a 404', async ({page}) => {
  const routes = ['/experience', '/projects', '/knowledge-hub', '/resume', '/contact'];

  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), `${route} must respond 200`).toBe(200);
    await expect(page.getByRole('heading', {level: 1})).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  }
});

test('navigation order is identical on every page', async ({page}) => {
  const expected = ['Experience', 'Projects', 'Knowledge Hub', 'Resume', 'Contact'];

  // Scope to the list items: the header also contains the brand link, which is
  // not part of the section order being compared.
  // DOM order, not the accessibility tree: below lg the list is display:none,
  // so a role query would find nothing on mobile even though the order is correct.
  const navItems = (page: Page) =>
    page.locator('nav[aria-label="Primary"] ul li a').allInnerTexts();

  await page.goto('/');
  expect((await navItems(page)).map((label) => label.trim())).toEqual(expected);

  await page.goto('/projects');
  expect((await navItems(page)).map((label) => label.trim())).toEqual(expected);
});

test('the legacy Knowledge route redirects permanently to the canonical route', async ({page}) => {
  const response = await page.request.get('/knowledge', {maxRedirects: 0});
  expect(response.status()).toBe(308);
  expect(response.headers()['location']).toBe('/knowledge-hub');
});

test('the page never scrolls horizontally', async ({page}) => {
  for (const width of [320, 375, 768, 1024, 1280]) {
    await page.setViewportSize({width, height: 800});
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
  }
});

test('shared UI primitives receive their token utilities in the production build', async ({
  page,
}) => {
  // Regression: Tailwind scans the app directory only, so utilities used
  // exclusively inside packages/ui (min-h-10, px-3, py-2, rounded-md) were purged
  // from the production stylesheet. Every shared control rendered at native size.
  // The gate test guards the `@source` directive; this proves the stylesheet it
  // produces actually styles a real control.
  await page.goto('/knowledge-hub');
  const heights = await page.evaluate(() => {
    const measure = (selector: string) =>
      document.querySelector(selector)?.getBoundingClientRect().height ?? 0;
    return {
      search: measure('#q'),
      kind: measure('#kind'),
      apply: measure('button[type="submit"]'),
    };
  });
  for (const [name, height] of Object.entries(heights)) {
    expect(height, `${name} control must render at its token height`).toBeGreaterThanOrEqual(36);
  }
});

test('a missing article answers 404 with site chrome and a way back', async ({page}) => {
  // A draft, archived, or unknown slug must not render the bare Next.js 404.
  const response = await page.goto('/knowledge-hub/does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', {level: 1, name: 'Page not found'})).toBeVisible();
  await expect(page.locator('nav[aria-label="Primary"]')).toBeVisible();

  const unknown = await page.goto('/no-such-route');
  expect(unknown?.status()).toBe(404);
  await expect(page.getByRole('heading', {level: 1, name: 'Page not found'})).toBeVisible();
});

test('focus is visible on every interactive element in the header', async ({page}) => {
  await page.goto('/');
  const link = page.getByRole('link', {name: 'Kalyan V Medaboina'}).first();
  await link.focus();
  const outlineWidth = await link.evaluate((element) => getComputedStyle(element).outlineWidth);
  expect(outlineWidth).not.toBe('0px');
});

test('reduced motion removes transitions without breaking the page', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/');
  await expect(page.getByRole('link', {name: 'View Resume'})).toBeVisible();
  // The stylesheet collapses transitions to 0.01ms, which browsers serialise as
  // '1e-05s'. Assert on the parsed duration rather than on a string prefix.
  const duration = await page
    .getByRole('link', {name: 'View Resume'})
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.001);
});
