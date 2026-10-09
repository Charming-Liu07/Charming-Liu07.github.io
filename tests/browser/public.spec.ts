import { test, expect } from '@playwright/test';

test('public blog preserves original routes, article, date and feed', async ({ page, request }) => {
  for (const route of [
    '/',
    '/blog/',
    '/about/',
    '/archives/',
    '/tags/',
    '/search/',
    '/post/about/',
    '/atom.xml',
  ]) {
    expect((await request.get(route)).status(), route).toBe(200);
  }
  expect((await request.get('/memory/')).status()).toBe(404);
  await page.goto('/post/about/');
  await expect(page.getByRole('heading', { name: '关于', exact: true })).toBeVisible();
  await expect(
    page.getByText('欢迎来到我的小站呀，很高兴遇见你！🤝', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('main')).toContainText('2024-11-02');
  const feed = await (await request.get('/atom.xml')).text();
  expect(feed).toContain('<entry>');
  expect(feed).toContain('关于');
  await expect(page.locator('a[href^="/memory/"]')).toHaveCount(0);
});

test('navigation and theme work on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: '主导航', exact: true });
  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', { name: /文章/ }).click();
  await expect(page).toHaveURL(/\/blog\/$/);
  await page.getByRole('button', { name: '切换深浅主题' }).click();
  const theme = await page.locator('html').getAttribute('data-theme');
  expect(['light', 'dark']).toContain(theme);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

test('built search finds real content and handles empty, missing and shared queries', async ({
  page,
}) => {
  test.skip(!process.env.PW_PREVIEW, 'Pagefind is created by the production build');
  await page.goto('/search/');
  const input = page.getByRole('searchbox', { name: '文章关键词' });
  await input.fill('欢迎');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page.locator('#search-status')).toContainText('找到 1 条结果');
  await expect(page.locator('#search-results a')).toHaveAttribute('href', '/post/about/');
  await page.reload();
  await expect(input).toHaveValue('欢迎');
  await expect(page.locator('#search-results a')).toHaveAttribute('href', '/post/about/');
  await input.fill('zzznomatchingarticlezzz');
  await expect(page.locator('#search-status')).toContainText('暂时没有找到');
  await input.fill('');
  await expect(page.locator('#search-results li')).toHaveCount(0);
  await expect(page.locator('#search-status')).toContainText('输入关键词');
});
