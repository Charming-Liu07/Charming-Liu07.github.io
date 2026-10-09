import { test, expect, type Locator, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(width.document, `document at ${width.viewport}px`).toBeLessThanOrEqual(width.viewport + 1);
  expect(width.body, `body at ${width.viewport}px`).toBeLessThanOrEqual(width.viewport + 1);
}

async function expectReadableContrast(locator: Locator, property = 'color', minimum = 4.5) {
  const sample = await locator.evaluate((element, property) => {
    type Color = [number, number, number, number];
    const color = (value: string): Color => {
      const parts = value.match(/[\d.]+/g)?.map(Number);
      if (!parts || parts.length < 3) throw new Error(`Unexpected computed color: ${value}`);
      return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
    };
    const over = (front: Color, back: Color): Color => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      return [
        ...[0, 1, 2].map(
          (channel) =>
            (front[channel]! * front[3] + back[channel]! * back[3] * (1 - front[3])) / alpha,
        ),
        alpha,
      ] as Color;
    };
    const luminance = (value: Color) => {
      const channels = value.slice(0, 3).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
    };
    const ancestry: Element[] = [];
    for (let current: Element | null = element; current; current = current.parentElement)
      ancestry.unshift(current);
    const background = ancestry.reduce(
      (back, current) => over(color(getComputedStyle(current).backgroundColor), back),
      [255, 255, 255, 1] as Color,
    );
    const foreground = over(
      color(getComputedStyle(element).getPropertyValue(property)),
      background,
    );
    const light = Math.max(luminance(foreground), luminance(background));
    const dark = Math.min(luminance(foreground), luminance(background));
    return { foreground, background, ratio: (light + 0.05) / (dark + 0.05) };
  }, property);
  expect(sample.ratio, JSON.stringify(sample)).toBeGreaterThanOrEqual(minimum);
}

for (const width of [320, 390, 768, 1440]) {
  test(`public reading pages fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/',
      '/blog/',
      '/archives/',
      '/tags/',
      '/about/',
      '/search/',
      '/post/about/',
    ]) {
      await page.goto(route);
      await expect(page.locator('main h1')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });
}

for (const theme of ['light', 'dark']) {
  test(`${theme} footer keeps keyboard focus clearly visible`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('charming-theme', value), theme);
    await page.goto('/');
    await page.keyboard.press('Tab');
    const link = page.getByRole('navigation', { name: '页脚导航' }).getByRole('link').first();
    await link.focus();
    await expect(link).toBeFocused();
    expect(await link.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    await expect(link).toHaveCSS('outline-style', 'solid');
    await expectReadableContrast(link, 'outline-color', 3);
  });
  test(`${theme} theme keeps text and main actions readable`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('charming-theme', value), theme);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expectReadableContrast(page.locator('body'));
    await expectReadableContrast(page.locator('.hero-description'));
    await expectReadableContrast(page.locator('.hero-actions a').first());
    await page.goto('/post/about/');
    await expectReadableContrast(page.locator('.prose'));
  });
}

test('phone navigation and theme controls have 44px touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const controls = [
    page.getByRole('button', { name: '切换深浅主题' }),
    page.getByRole('link', { name: '搜索公开文章' }),
    ...(await page
      .getByRole('navigation', { name: '主导航', exact: true })
      .getByRole('link')
      .all()),
  ];
  for (const control of controls) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  const fontSize = await page
    .locator('.hero-description')
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(16);
});

test('Ctrl K opens search without interrupting text input', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page).toHaveURL(/\/search\/$/);
  const input = page.getByRole('searchbox', { name: '文章关键词' });
  await input.fill('欢迎');
  await input.press('Control+k');
  await expect(input).toHaveValue('欢迎');
  await expect(page).toHaveURL(/\/search\//);
});

test('reduced motion leaves content readable with no running animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('.hero-description')).toBeVisible();
  const activeMotion = await page
    .locator('main')
    .evaluate(
      (element) =>
        element
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === 'running').length,
    );
  expect(activeMotion).toBe(0);
});

test('public reading and navigation work without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
    baseURL,
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('.hero-description')).toBeVisible();
    const navigation = page.getByRole('navigation', { name: '主导航', exact: true });
    await expect(navigation).toBeVisible();
    await navigation.getByRole('link', { name: /文章/ }).click();
    await expect(page).toHaveURL(/\/blog\/$/);
    await page.goto('/post/about/');
    await expect(
      page.getByText('欢迎来到我的小站呀，很高兴遇见你！🤝', { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    await context.close();
  }
});

test('a zoomed desktop keeps all navigation available', async ({ page }) => {
  // A 1440px desktop at 200% browser zoom has a 720 CSS-pixel layout viewport.
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  const navigation = page.getByRole('navigation', { name: '主导航', exact: true });
  await expect(navigation).toBeVisible();
  for (const link of await navigation.getByRole('link').all()) await expect(link).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
