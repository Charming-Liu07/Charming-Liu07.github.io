import { test, expect } from '@playwright/test';

test('public blog preserves legacy routes, article content, date and feed', async ({
  page,
  request,
}) => {
  for (const path of ['/', '/archives/', '/tags/', '/post/about/', '/atom.xml']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }
  await page.goto('/post/about/');
  await expect(page.getByRole('heading', { name: '关于', exact: true }).first()).toBeVisible();
  await expect(
    page.getByText('欢迎来到我的小站呀，很高兴遇见你！🤝', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('main')).toContainText('2024-11-02');
  const feed = await request.get('/atom.xml');
  expect(await feed.text()).toContain('<entry>');
  expect(await feed.text()).toContain('关于');
});

test('public navigation, theme and mobile layout remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: '移动导航' })).toBeVisible();
  await page.getByRole('button', { name: '切换深浅主题' }).click();
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('built public search finds the original article and excludes the private workspace', async ({
  page,
}) => {
  test.skip(!process.env.PW_PREVIEW, 'Pagefind is created by the production build');
  await page.goto('/memory/');
  await page.getByRole('button', { name: '新建记忆', exact: true }).first().click();
  await page.getByLabel('标题', { exact: true }).fill('搜索隔离测试');
  await page.getByLabel('摘要', { exact: true }).fill('privatememorysentinelsecrettest');
  await page.getByRole('button', { name: '保存记忆', exact: true }).click();
  await page.goto('/search/');
  await page.getByRole('searchbox', { name: '文章关键词' }).fill('欢迎');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page.locator('#search-status')).toContainText('找到 1 条结果');
  await expect(page.locator('#search-results a')).toHaveAttribute('href', '/post/about/');
  await page.getByRole('searchbox', { name: '文章关键词' }).fill('privatememorysentinelsecrettest');
  await expect(page.locator('#search-status')).toContainText('暂时没有找到');
});
