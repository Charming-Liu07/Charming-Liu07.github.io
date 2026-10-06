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

async function expectReadableContrast(locator: Locator) {
  const sample = await locator.evaluate((element) => {
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
    const foreground = over(color(getComputedStyle(element).color), background);
    const light = Math.max(luminance(foreground), luminance(background));
    const dark = Math.min(luminance(foreground), luminance(background));
    return { foreground, background, ratio: (light + 0.05) / (dark + 0.05) };
  });
  expect(sample.ratio, JSON.stringify(sample)).toBeGreaterThanOrEqual(4.5);
}

for (const width of [320, 390, 768, 901, 1024, 1440, 1920]) {
  test(`home and memory fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/memory/']) {
      await page.goto(path);
      await expect(page.locator('main h1').first()).toBeVisible();
      if (path === '/memory/')
        await expect(
          page.getByRole('button', { name: '新建记忆', exact: true }).first(),
        ).toBeEnabled();
      await expectNoHorizontalOverflow(page);
    }
  });
}

for (const theme of ['light', 'dark']) {
  test(`${theme} theme keeps body, muted copy and primary actions readable`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('charming-theme', value), theme);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expectReadableContrast(page.locator('body'));
    await expectReadableContrast(page.locator('.hero-description'));
    await expectReadableContrast(page.locator('.hero-actions .button').first());
    await page.goto('/memory/');
    const create = page.getByRole('button', { name: '新建记忆', exact: true }).first();
    await expect(create).toBeEnabled();
    await expectReadableContrast(page.locator('body'));
    await expectReadableContrast(page.locator('.mw-header p').first());
    await expectReadableContrast(create);
  });
}

test('shared phone controls have 44px touch targets and normal copy is readable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const controls = [
    page.getByRole('button', { name: '切换深浅主题' }),
    page.getByRole('link', { name: '搜索公开文章' }),
    ...(await page.getByRole('navigation', { name: '移动导航' }).getByRole('link').all()),
  ];
  for (const control of controls) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(
      box!.width,
      (await control.getAttribute('aria-label')) ?? 'control width',
    ).toBeGreaterThanOrEqual(44);
    expect(box!.height, (await control.textContent()) ?? 'control height').toBeGreaterThanOrEqual(
      44,
    );
  }
  expect(
    await page
      .locator('.hero-description')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await page.goto('/memory/');
  await page.getByRole('button', { name: '新建记忆', exact: true }).first().click();
  for (const control of await page.getByRole('dialog').locator('input, textarea, select').all()) {
    expect(
      await control.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    ).toBeGreaterThanOrEqual(16);
  }
});

test('Ctrl K opens public article search from the document', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page).toHaveURL(/\/search\/$/);
  await expect(page.getByRole('searchbox', { name: '文章关键词' })).toBeVisible();
});

test('Ctrl K preserves the unsaved memory editor draft', async ({ page }) => {
  await page.goto('/memory/');
  await page.getByRole('button', { name: '新建记忆', exact: true }).first().click();
  await page.getByLabel('标题', { exact: true }).fill('仍在编辑的记忆');
  await page.getByLabel('摘要', { exact: true }).fill('快捷键不能带走这段未保存的内容。');
  for (const control of [
    page.getByLabel('摘要', { exact: true }),
    page.getByRole('button', { name: '保存记忆', exact: true }),
    page.getByRole('button', { name: '取消', exact: true }),
    page.getByRole('button', { name: '关闭对话框' }),
  ]) {
    await control.focus();
    await control.press('Control+k');
    await expect(page).toHaveURL(/\/memory\/$/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('标题', { exact: true })).toHaveValue('仍在编辑的记忆');
    await expect(page.getByLabel('摘要', { exact: true })).toHaveValue(
      '快捷键不能带走这段未保存的内容。',
    );
  }
});

test('public links have phone-sized touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const routes: [string, string[]][] = [
    ['/about/', ['.mobile-brand', '.about-intro a', '.about-columns a', '.about-links a']],
    ['/blog/', ['.article-toolbar a', '.subscribe-note a', '.article-grid .read-link']],
    ['/archives/', ['.archive-year a']],
    ['/post/about/', ['.back-link', '.post-footer a']],
  ];
  for (const [path, selectors] of routes) {
    await page.goto(path);
    for (const selector of selectors) {
      const links = page.locator(selector);
      expect(await links.count(), `${path} ${selector}`).toBeGreaterThan(0);
      for (const link of await links.all()) {
        const box = await link.boundingBox();
        expect(
          box!.height,
          `${path} ${selector}: ${await link.textContent()}`,
        ).toBeGreaterThanOrEqual(44);
      }
    }
  }
});

test('short desktop sidebar scrolls to every navigation link', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto('/');
  const sidebar = page.locator('.sidebar');
  await expect(sidebar).toBeVisible();
  const rss = sidebar.locator('.sidebar-collections a[href="/atom.xml"]');
  const owner = sidebar.locator('.owner a');
  const initial = await rss.boundingBox();
  expect(initial!.y).toBeGreaterThanOrEqual(540);
  await sidebar.hover({ position: { x: 100, y: 270 } });
  await page.mouse.wheel(0, 600);
  await expect.poll(() => sidebar.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  for (const link of [rss, owner]) {
    const box = await link.boundingBox();
    const label = (await link.textContent()) ?? '';
    expect(box!.y, label).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height, label).toBeLessThanOrEqual(540);
  }
});

test('Escape returns focus to the memory dialog activating button', async ({ page }) => {
  await page.goto('/memory/');
  const activate = page.getByRole('button', { name: '新建记忆', exact: true }).first();
  await activate.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('标题', { exact: true }).fill('可用 Escape 关闭');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(activate).toBeFocused();
});

test('reduced motion shows revealed content without animation or scene movement', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  const reveal = page.locator('[data-reveal]');
  expect(await reveal.count()).toBeGreaterThan(0);
  for (const element of await reveal.all()) {
    await element.scrollIntoViewIfNeeded();
    await expect(element).toBeVisible();
    await expect(element).toHaveCSS('opacity', '1');
    await expect(element).toHaveCSS('transform', 'none');
  }
  const activeMotion = await page
    .locator('[data-reveal], [data-memory-scene], [data-scene-layer]')
    .evaluateAll(
      (elements) =>
        elements.flatMap((element) =>
          element.getAnimations().filter((animation) => animation.playState === 'running'),
        ).length,
    );
  expect(activeMotion).toBe(0);
  expect(
    await page.locator('[data-memory-scene]').evaluate((element) => {
      const style = getComputedStyle(element);
      return [
        Number.parseFloat(style.getPropertyValue('--scene-x')) || 0,
        Number.parseFloat(style.getPropertyValue('--scene-y')) || 0,
      ];
    }),
  ).toEqual([0, 0]);
});

test('public content and navigation remain visible with JavaScript disabled', async ({
  browser,
  baseURL,
}) => {
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
    await expect(page.locator('.hero-description')).toHaveCSS('opacity', '1');
    for (const element of await page.locator('[data-reveal]').all()) {
      await expect(element).toHaveCSS('opacity', '1');
      await expect(element).toHaveCSS('transform', 'none');
    }
    const navigation = page.getByRole('navigation', { name: '移动导航' });
    await expect(navigation).toBeVisible();
    await navigation.getByRole('link', { name: '文章', exact: true }).click();
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

test('200 percent layout zoom keeps navigation, content and the memory editor usable', async ({
  page,
}) => {
  // A 1440px desktop at 200% browser zoom has a 720 CSS-pixel layout viewport.
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.getByRole('navigation', { name: '移动导航' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.goto('/memory/');
  await page.getByRole('button', { name: '新建记忆', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(720);
  await page.getByLabel('标题', { exact: true }).fill('放大布局仍可操作');
  await page.getByLabel('摘要', { exact: true }).fill('滚动对话框后仍然可以保存。');
  await page.getByRole('button', { name: '保存记忆', exact: true }).click();
  await expect(page.locator('.mw-card h3')).toHaveText('放大布局仍可操作');
  await expectNoHorizontalOverflow(page);
});

test('long Chinese memory titles and summaries wrap on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/memory/');
  const title = '这是一条需要完整保留的中文长标题'.repeat(8);
  const summary = '对话里的想法和重要决定都应完整显示，继续思考时可以找到原来的上下文。'.repeat(20);
  await page.getByRole('button', { name: '新建记忆', exact: true }).first().click();
  await page.getByLabel('标题', { exact: true }).fill(title);
  await page.getByLabel('摘要', { exact: true }).fill(summary);
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: '保存记忆', exact: true }).click();
  await expect(page.locator('.mw-card h3')).toHaveText(title);
  await expect(page.locator('.mw-summary')).toHaveText(summary);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expectNoHorizontalOverflow(page);
    expect(
      await page
        .locator('.mw-card')
        .evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBeLessThanOrEqual(1);
  }
});

test('the original memory scene stays visible within a phone layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const scene = page.locator('[data-memory-scene]');
  await expect(scene).toBeVisible();
  const box = await scene.boundingBox();
  expect(box!.width).toBeGreaterThan(100);
  expect(box!.height).toBeGreaterThan(100);
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(391);
  expect(await scene.locator('[data-scene-layer]').count()).toBeGreaterThan(0);
  await expectNoHorizontalOverflow(page);
});

test('fine pointer scene motion resets when leaving and when preferences change', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'enabled');
  const scene = page.locator('[data-memory-scene]');
  await expect(scene).toBeVisible();
  const box = await scene.boundingBox();
  const offset = () =>
    scene.evaluate((element) => {
      const style = getComputedStyle(element);
      return [
        Number.parseFloat(style.getPropertyValue('--scene-x')) || 0,
        Number.parseFloat(style.getPropertyValue('--scene-y')) || 0,
      ];
    });
  await page.mouse.move(box!.x + box!.width * 0.8, box!.y + box!.height * 0.2);
  await expect
    .poll(async () => (await offset()).some((value) => Math.abs(value) > 0.01))
    .toBe(true);
  await page.mouse.move(0, 0);
  await expect.poll(offset).toEqual([0, 0]);
  await page.mouse.move(box!.x + box!.width * 0.8, box!.y + box!.height * 0.2);
  await expect
    .poll(async () => (await offset()).some((value) => Math.abs(value) > 0.01))
    .toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await expect.poll(offset).toEqual([0, 0]);
});
