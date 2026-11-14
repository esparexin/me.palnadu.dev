import {expect, test, type Page} from '@playwright/test';

/**
 * Professional experience list and detail popup (UI_UX_STANDARDS 7.3;
 * TESTING.md section 7 journeys 2 and 4).
 *
 * The section is presentation-only over `lib/experience.ts`, so these journeys
 * pin the list structure, the newest-first order, and the popup contract —
 * not the career facts themselves.
 */

const desktop = {width: 1280, height: 800};
const mobile = {width: 375, height: 667};

const rowList = (page: Page) => page.getByRole('list', {name: 'Professional experience entries'});

const firstRowButton = (page: Page) =>
  rowList(page).getByRole('listitem').first().getByRole('button');

test('the list renders every role newest first with each detail as plain text', async ({page}) => {
  await page.setViewportSize(desktop);
  await page.goto('/experience');

  const rows = rowList(page).getByRole('listitem');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText('Zazz IT Solutions Private Limited');
  await expect(rows.nth(1)).toContainText('eSF Labs Limited');
  await expect(rows.nth(2)).toContainText('United States Pharmacopeia (USP)');
  await expect(rows.nth(3)).toContainText('BrandPier Software Pvt. Ltd.');

  await expect(rows.nth(0)).toContainText('System Administrator');
  await expect(rows.nth(0)).toContainText('August 2024 – February 2026');
  await expect(rows.nth(0)).toContainText('Hyderabad');

  // The competency cards that used to sit beside the roles are gone for good.
  await expect(page.getByText('Enterprise MDM Architecture')).toHaveCount(0);
  await expect(page.getByText('Cybersecurity & ISO 27001')).toHaveCount(0);
});

test('the experience page gives the ring the whole screen', async ({page}) => {
  await page.setViewportSize(desktop);
  await page.goto('/experience');

  const section = page.locator('section#experience');
  const box = await section.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(desktop.height);

  // The ring fills the card it is in, rather than leaving a band of the
  // card's own background below the control row.
  const card = page.locator('section[aria-roledescription="carousel"]').first();
  const carouselBox = await card.boundingBox();
  const holderBox = await page
    .locator('section[aria-roledescription="carousel"]')
    .first()
    .evaluate((element) => {
      const parent = element.parentElement;
      if (parent === null) return null;
      const rect = parent.getBoundingClientRect();
      return {top: rect.top, bottom: rect.bottom};
    });
  expect(carouselBox).not.toBeNull();
  expect(holderBox).not.toBeNull();
  expect(
    Math.abs((carouselBox?.height ?? 0) - ((holderBox?.bottom ?? 0) - (holderBox?.top ?? 0))),
  ).toBeLessThanOrEqual(2);
});

test('the rows are cards and carry no separate link', async ({page}) => {
  await page.setViewportSize(desktop);
  await page.goto('/experience');

  const rows = rowList(page).getByRole('listitem');
  await expect(rows).toHaveCount(4);

  // The whole row is the control, so there is no second link inside it.
  await expect(page.getByText('View Experience')).toHaveCount(0);
  for (const row of await rows.all()) {
    await expect(row.getByRole('button')).toHaveCount(1);
    await expect(row.getByRole('link')).toHaveCount(0);
  }
});

test('activating a row opens the detail popup with a visible Close and scroll region', async ({
  page,
}) => {
  await page.setViewportSize(desktop);
  await page.goto('/experience');

  const button = firstRowButton(page);
  await expect(button).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(button).toHaveAttribute('aria-expanded', 'false');

  await button.click();
  const dialog = page.getByRole('dialog', {name: 'Zazz IT Solutions Private Limited'});
  await expect(dialog).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');

  const closeButton = dialog.getByRole('button', {name: 'Close experience details'});
  await expect(closeButton).toBeVisible();

  const region = dialog.getByRole('region', {name: 'Experience details'});
  await expect(region).toHaveAttribute('tabindex', '0');
  const overflowY = await region.evaluate((element) => getComputedStyle(element).overflowY);
  expect(overflowY).toBe('auto');

  await closeButton.click();
  await expect(dialog).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('Escape dismisses the popup and returns focus to the invoking row', async ({page}) => {
  await page.setViewportSize(desktop);
  await page.goto('/experience');

  const button = firstRowButton(page);
  await button.click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('mobile opens a bottom sheet that locks the page and restores focus on close', async ({
  page,
}) => {
  await page.setViewportSize(mobile);
  await page.goto('/experience');

  const button = firstRowButton(page);
  await button.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', {name: 'Close experience details'})).toBeVisible();
  await expect(dialog.getByRole('region', {name: 'Experience details'})).toBeVisible();

  const positionWhileOpen = await page.evaluate(() => getComputedStyle(document.body).position);
  expect(positionWhileOpen).toBe('fixed');

  await dialog.getByRole('button', {name: 'Close experience details'}).click();
  await expect(dialog).toHaveCount(0);
  // Focus restoration happens in the same cleanup that unlocks the page, so
  // a passed focus assertion proves the unlock already ran.
  await expect(button).toBeFocused();
  const positionAfterClose = await page.evaluate(() => getComputedStyle(document.body).position);
  expect(positionAfterClose).toBe('static');
});
