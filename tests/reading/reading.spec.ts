import { test, expect, type Page } from '@playwright/test';

const route = '/post/reading-navigation-fixture/';
const description = '</script><script id="metadata-escape">window.metadataEscape=true</script>';
const published = '2024-11-01T00:00:00.000Z';
const updated = '2026-10-10T00:00:00.000Z';

async function expectSectionNearTop(page: Page, id: string) {
  await expect
    .poll(() =>
      page.locator(`[id="${id}"]`).evaluate((heading) => heading.getBoundingClientRect().top),
    )
    .toBeGreaterThanOrEqual(0);
  await expect
    .poll(() =>
      page.locator(`[id="${id}"]`).evaluate((heading) => heading.getBoundingClientRect().top),
    )
    .toBeLessThan(110);
}

test('an article without section headings has no TOC or invented update date', async ({ page }) => {
  await page.goto('/post/about/');
  await expect(page.getByRole('complementary', { name: '文章目录' })).toHaveCount(0);
  await expect(page.locator('.post-meta')).not.toContainText('更新于');
  await expect(page.locator('.post-meta time')).toHaveCount(1);
});

test('desktop TOC stays open, sticks, and tracks scrolling and hash navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(route);
  const toc = page.getByRole('complementary', { name: '文章目录' });
  await expect(toc.locator('details')).toHaveAttribute('open', '');
  await expect(toc).toHaveCSS('position', 'sticky');
  const links = toc.getByRole('link');
  await expect(links).toHaveCount(5);
  const lastId = (await links.last().getAttribute('href'))!.slice(1);
  await links.last().click();
  await expectSectionNearTop(page, lastId);
  await expect(links.last()).toHaveAttribute('aria-current', 'location');
  await expect(toc.locator('[aria-current="location"]')).toHaveCount(1);
  expect((await toc.boundingBox())!.y).toBeGreaterThanOrEqual(30);
  expect((await toc.boundingBox())!.y).toBeLessThan(50);

  const secondId = (await links.nth(1).getAttribute('href'))!.slice(1);
  await page
    .locator(`[id="${secondId}"]`)
    .evaluate((heading) => heading.scrollIntoView({ behavior: 'instant' }));
  await expect(links.nth(1)).toHaveAttribute('aria-current', 'location');
  await page.goto(`${route}#${lastId}`);
  await expect(links.last()).toHaveAttribute('aria-current', 'location');
  await expectSectionNearTop(page, lastId);
});

test('phone TOC starts collapsed, supports the keyboard, and closes before native anchor positioning', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route);
  const toc = page.getByRole('complementary', { name: '文章目录' });
  const details = toc.locator('details');
  const summary = toc.locator('summary');
  await expect(details).not.toHaveAttribute('open');
  const target = await summary.boundingBox();
  expect(target!.height).toBeGreaterThanOrEqual(44);
  await summary.focus();
  await page.keyboard.press('Space');
  await expect(details).toHaveAttribute('open', '');
  const link = toc.locator('a[data-section]').nth(2);
  const id = (await link.getAttribute('href'))!.slice(1);
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`#${encodeURIComponent(id)}$`));
  await expect(details).not.toHaveAttribute('open');
  await expectSectionNearTop(page, id);
  await expect(link).toHaveAttribute('aria-current', 'location');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('TOC follows phone and desktop breakpoints and stays usable after resizing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${route}#阅读章节-3`);
  const toc = page.getByRole('complementary', { name: '文章目录' });
  const details = toc.locator('details');
  const selected = toc.locator('a[href="#阅读章节-3"]');
  await expect(details).not.toHaveAttribute('open');
  await expect(selected).toHaveAttribute('aria-current', 'location');
  await expectSectionNearTop(page, '阅读章节-3');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(details).toHaveAttribute('open', '');
  await selected.click();
  await expectSectionNearTop(page, '阅读章节-3');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(details).not.toHaveAttribute('open');
  await expect(page.locator('main h1')).toBeAttached();
  await expect(toc.locator('[aria-current="location"]')).toHaveCount(1);
});

test('native TOC and reading remain usable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
    baseURL,
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await page.goto(route);
    const toc = page.getByRole('complementary', { name: '文章目录' });
    await expect(toc.locator('details')).toHaveAttribute('open', '');
    const link = toc.getByRole('link').last();
    const id = (await link.getAttribute('href'))!.slice(1);
    await link.click();
    await expectSectionNearTop(page, id);
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
    await expect(page.getByRole('heading', { name: '阅读章节 5' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('an updated article has safe sharing data and truthful publication dates', async ({
  page,
}) => {
  await page.goto(route);
  await expect(page.locator('.post-meta')).toContainText('更新于 2026-10-10');
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  await expect(page.locator('meta[property="article:published_time"]')).toHaveAttribute(
    'content',
    published,
  );
  await expect(page.locator('meta[property="article:modified_time"]')).toHaveAttribute(
    'content',
    updated,
  );
  await expect(page.locator('#metadata-escape')).toHaveCount(0);
  expect(await page.evaluate(() => 'metadataEscape' in window)).toBe(false);
  const data = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent())!,
  );
  expect(data['@type']).toBe('BlogPosting');
  expect(data.description).toBe(description);
  expect(data.datePublished).toBe(published);
  expect(data.dateModified).toBe(updated);
});

test('Atom uses the old article modification date for its entry and feed update', async ({
  page,
}) => {
  const response = await page.request.get('/atom.xml');
  expect(response.ok()).toBe(true);
  const dates = await page.evaluate(
    (xml) => {
      const document = new DOMParser().parseFromString(xml, 'application/xml');
      const entry = [...document.querySelectorAll('entry')].find((entry) =>
        entry.querySelector('id')?.textContent?.includes('/post/reading-navigation-fixture/'),
      );
      return {
        feed: document.querySelector('feed > updated')?.textContent,
        published: entry?.querySelector('published')?.textContent,
        updated: entry?.querySelector('updated')?.textContent,
      };
    },
    await response.text(),
  );
  expect(dates).toEqual({ feed: updated, published, updated });
});
