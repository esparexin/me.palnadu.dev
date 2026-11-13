import {expect, test, type Page} from '@playwright/test';

/**
 * The floating navigation trigger (UI_UX_STANDARDS 7.2).
 *
 * Below `lg` the trigger is fixed to the right edge and vertically centred, so
 * it sits over whatever the middle of the viewport happens to contain. The
 * design checklist in UI_UX_STANDARDS 9 requires that no content is hidden
 * behind it, and the measured failures this guards against were real: the
 * hero tagline, the career section description, the ring readout, and the
 * project notice were each partly covered before the clearance was added.
 *
 * The measurement is done on rendered text, not on boxes: a line box can be
 * wider than the glyphs it paints, and an element clipped by an ancestor
 * (`truncate`, `overflow-hidden`) paints nothing beyond its clip edge. Text
 * that is visually hidden, such as the screen-reader-only list, is excluded.
 */

const viewports = [
  {width: 320, height: 568},
  {width: 320, height: 800},
  {width: 390, height: 844},
  {width: 412, height: 915},
];

const routes = ['/', '/experience', '/projects', '/knowledge-hub', '/resume', '/contact'];

/**
 * The article routes the Knowledge Hub links to.
 *
 * They are discovered rather than listed, so the suite follows whatever the
 * hub actually advertises: published articles where there are any, and the
 * scaffold cards where there are not.
 */
const articleRoutes = async (page: Page): Promise<string[]> => {
  await page.goto('/knowledge-hub', {waitUntil: 'domcontentloaded'});
  const hrefs = await page.evaluate(() =>
    Array.from(
      new Set(
        Array.from(document.querySelectorAll('a[href^="/knowledge-hub/"]')).map((anchor) =>
          anchor.getAttribute('href'),
        ),
      ),
    ).filter((href): href is string => href !== null),
  );
  return hrefs;
};

interface CoveredText {
  text: string;
  area: number;
}

const coveredByTrigger = async (page: Page): Promise<CoveredText[]> =>
  page.evaluate(() => {
    const trigger = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Open navigation menu"]',
    );
    if (trigger === null) return [];
    const triggerBox = trigger.getBoundingClientRect();

    const intersect = (a: DOMRect, b: DOMRect): DOMRect | null => {
      const left = Math.max(a.left, b.left);
      const top = Math.max(a.top, b.top);
      const right = Math.min(a.right, b.right);
      const bottom = Math.min(a.bottom, b.bottom);
      if (right <= left || bottom <= top) return null;
      return new DOMRect(left, top, right - left, bottom - top);
    };

    /** The area of the element that is actually painted, after every clip. */
    const paintBox = (element: Element): DOMRect | null => {
      const own = element.getBoundingClientRect();
      if (own.width <= 2 || own.height <= 2) return null;
      let box: DOMRect | null = own;
      for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.visibility === 'hidden' || style.display === 'none') return null;
        if (style.clipPath !== 'none') return null;
        if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
          box = box === null ? null : intersect(box, parent.getBoundingClientRect());
          if (box === null) return null;
        }
      }
      return box;
    };

    const covered: {text: string; area: number}[] = [];

    const walk = (node: Node): void => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent?.trim() ?? '';
          if (text === '') continue;
          const parent = child.parentElement;
          if (parent === null) continue;
          const painted = paintBox(parent);
          if (painted === null) continue;
          const range = document.createRange();
          range.selectNodeContents(child);
          for (const line of Array.from(range.getClientRects())) {
            if (line.width <= 2 || line.height <= 2) continue;
            const visible = intersect(line, painted);
            if (visible === null) continue;
            const overlap = intersect(visible, triggerBox);
            if (overlap !== null)
              covered.push({text, area: Math.round(overlap.width * overlap.height)});
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      }
    };

    walk(document.body);
    return covered;
  });

for (const viewport of viewports) {
  test(`no text is covered by the floating trigger at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const articles = await articleRoutes(page);

    for (const route of [...routes, ...articles]) {
      await page.goto(route, {waitUntil: 'domcontentloaded'});
      await page.waitForLoadState('load');

      const height = await page.evaluate(() => document.body.scrollHeight);
      const positions = [0, Math.round((height - viewport.height) / 2), height - viewport.height];

      for (const offset of positions) {
        await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, offset));
        await page.waitForTimeout(150);
        const covered = await coveredByTrigger(page);
        expect(
          covered,
          `text covered by the floating trigger on ${route} at scroll ${offset}`,
        ).toEqual([]);
      }
    }
  });
}
