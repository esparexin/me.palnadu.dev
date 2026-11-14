import {expect, test, type Page} from '@playwright/test';

/**
 * The career ring (UI_UX_STANDARDS 7.3).
 *
 * The ring is a pointer-driven control: it is dragged and it scrolls on the
 * wheel. WCAG 2.5.7 requires a single-pointer equivalent for any dragging
 * movement, and the standards require visible navigation controls, so the ring
 * carries a previous and a next button, a position indicator, a live
 * announcement, and a keyboard path into the same state.
 */

const mobile = {width: 390, height: 844};

const openHome = async (page: Page): Promise<void> => {
  await page.setViewportSize(mobile);
  await page.goto('/');
  await page.getByRole('button', {name: 'Next entry'}).waitFor();
};

test('the ring exposes a previous and a next control with a usable target size', async ({page}) => {
  await openHome(page);

  const previous = page.getByRole('button', {name: 'Previous entry'});
  const next = page.getByRole('button', {name: 'Next entry'});
  await expect(previous).toBeVisible();
  await expect(next).toBeVisible();

  // 2.5.5: 44x44 for a primary control.
  const box = await next.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});

test('the controls move the ring and the position indicator follows', async ({page}) => {
  await openHome(page);

  await expect(page.getByText('01 / 06')).toBeVisible();

  await page.getByRole('button', {name: 'Next entry'}).click();
  await expect(page.getByText('02 / 06')).toBeVisible();

  await page.getByRole('button', {name: 'Previous entry'}).click();
  await expect(page.getByText('01 / 06')).toBeVisible();
});

test('the position is announced, not shown by shape alone', async ({page}) => {
  await openHome(page);

  const announcement = page.locator('[aria-live="polite"]', {hasText: 'entry'});
  await expect(announcement).toHaveText('Zazz IT Solutions, entry 1 of 6');

  await page.getByRole('button', {name: 'Next entry'}).click();
  await expect(announcement).toHaveText('eSF Labs Limited, entry 2 of 6');
});

test('the arrow keys and Home and End reach the same entries', async ({page}) => {
  await openHome(page);

  await page.getByRole('button', {name: 'Next entry'}).focus();

  // ArrowDown moves to the next entry, ArrowUp back to the previous one, and
  // the ring wraps rather than stopping at the end.
  await page.keyboard.press('ArrowDown');
  await expect(page.getByText('02 / 06')).toBeVisible();

  await page.keyboard.press('ArrowUp');
  await expect(page.getByText('01 / 06')).toBeVisible();

  await page.keyboard.press('ArrowUp');
  await expect(page.getByText('06 / 06')).toBeVisible();

  await page.keyboard.press('Home');
  await expect(page.getByText('01 / 06')).toBeVisible();

  await page.keyboard.press('End');
  await expect(page.getByText('06 / 06')).toBeVisible();
});

test('the details of the entry in front open from the control row', async ({page}) => {
  await openHome(page);

  await page.getByRole('button', {name: 'Open details for Zazz IT Solutions'}).click();
  const dialog = page.getByRole('dialog', {name: 'Zazz IT Solutions Private Limited'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('region', {name: 'Experience details'})).toBeVisible();
});

test('pressing a card in the ring opens the details it stands for', async ({page}) => {
  await openHome(page);

  // The card at the front is the first entry, and it is the one the readout
  // names. A press on the canvas resolves the card under the pointer. The ring
  // sits below the fold, so it is brought into view first: a mouse click works
  // in viewport coordinates and does not scroll on its own.
  const canvas = page.locator('section[aria-roledescription="carousel"] canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
  );

  await expect(page.getByRole('dialog', {name: 'Zazz IT Solutions Private Limited'})).toBeVisible();
});
