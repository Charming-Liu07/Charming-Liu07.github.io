import { test, expect } from '@playwright/test';

test('a phone shows the latest article title without scrolling past the hero', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const title = page.locator('.latest-writing .article-title').first();
  await expect(title).toBeVisible();
  const titleBox = await title.boundingBox();
  expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(844);
  await expect(page.locator('.hero-art .pixel-letter')).toBeVisible();

  for (const link of await page.locator('.hero-actions a').all()) {
    const box = await link.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  if (process.env.BLOG_QA_SCREENSHOTS) {
    await page.screenshot({ path: testInfo.outputPath('home-phone.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: testInfo.outputPath('home-desktop.png') });
  }
});
