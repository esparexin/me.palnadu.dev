import {expect, test, type Page} from '@playwright/test';

/**
 * Floating navigation menu (UI_UX_STANDARDS 7.2).
 *
 * The header list is hidden below lg, so the floating menu is the only
 * navigation a small-viewport visitor has. The journeys below pin the four
 * close conditions (Escape, outside press, route change, close control), the
 * focus contract, and the viewport switch at lg.
 */

const mobile = {width: 390, height: 844};
const desktop = {width: 1280, height: 800};

const openMenu = async (page: Page) => {
  await page.setViewportSize(mobile);
  await page.goto('/');
  const trigger = page.getByRole('button', {name: 'Open navigation menu'});
  await trigger.click();
  const panel = page.getByRole('dialog', {name: 'Site navigation'});
  await expect(panel).toBeVisible();
  return {trigger, panel};
};

test('the trigger replaces the header list below lg and is hidden at lg', async ({page}) => {
  await page.setViewportSize(mobile);
  await page.goto('/');
  const trigger = page.getByRole('button', {name: 'Open navigation menu'});
  await expect(trigger).toBeVisible();
  await expect(page.locator('nav[aria-label="Primary"] ul')).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await page.setViewportSize(desktop);
  await expect(trigger).toBeHidden();
  await expect(page.locator('nav[aria-label="Primary"] ul')).toBeVisible();
});

test('opening focuses the first item and Escape closes back to the trigger', async ({page}) => {
  const {trigger, panel} = await openMenu(page);

  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.getByRole('link', {name: 'About Me'})).toBeFocused();

  // Same items in the same order as the header list (WCAG 3.2.3).
  await expect(panel.getByRole('link')).toHaveText([
    'About Me',
    'Experience',
    'Projects',
    'Knowledge Hub',
    'Resume',
    'Contact',
  ]);

  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
});

test('a pointer press outside the panel closes it', async ({page}) => {
  const {panel} = await openMenu(page);

  await page.mouse.click(10, 500);
  await expect(panel).toHaveCount(0);
});

test('the visible close control closes the panel', async ({page}) => {
  const {trigger, panel} = await openMenu(page);

  await panel.getByRole('button', {name: 'Close navigation menu'}).click();
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('selecting an item closes the panel and follows the route', async ({page}) => {
  const {panel} = await openMenu(page);

  await panel.getByRole('link', {name: 'Resume'}).click();
  await expect(page).toHaveURL(/\/resume$/);
  await expect(panel).toHaveCount(0);
});

test('Tab past the last item wraps to the close control and back', async ({page}) => {
  const {panel} = await openMenu(page);

  const close = panel.getByRole('button', {name: 'Close navigation menu'});
  const contact = panel.getByRole('link', {name: 'Contact'});

  for (const label of ['Experience', 'Projects', 'Knowledge Hub', 'Resume', 'Contact']) {
    await page.keyboard.press('Tab');
    await expect(panel.getByRole('link', {name: label})).toBeFocused();
  }

  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(contact).toBeFocused();
});

test('growing the viewport to lg closes the panel', async ({page}) => {
  const {panel} = await openMenu(page);

  await page.setViewportSize(desktop);
  await expect(panel).toHaveCount(0);
});
