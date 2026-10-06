import { test, expect } from '@playwright/test';

test('dialog interior whitespace preserves an unsaved memory draft', async ({ page }) => {
  await page.goto('/memory/');
  await page.getByRole('button', { name: '新建记忆', exact: true }).first().click();
  await page.getByLabel('标题', { exact: true }).fill('未保存的草稿');
  const box = await page.getByRole('dialog').boundingBox();
  await page.mouse.click(box!.x + 5, box!.y + 50);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('未保存的草稿');
});

async function downloadedText(download: import('@playwright/test').Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('Expected a downloadable file');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test('private workspace starts empty, creates a memory and persists on reload', async ({
  page,
}) => {
  const response = await page.goto('/memory/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('button', { name: '新建记忆', exact: true }).first()).toBeEnabled();
  await page.getByRole('button', { name: '新建记忆', exact: true }).first().click();
  await page.getByLabel('标题', { exact: true }).fill('私人测试记忆');
  await page
    .getByLabel('摘要', { exact: true })
    .fill('private-sentinel-20261006：喜欢清晰的中文解释。');
  await page.getByRole('button', { name: '保存记忆', exact: true }).click();
  await expect(page.getByText('私人测试记忆', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('私人测试记忆', { exact: true }).first()).toBeVisible();
});

test('conversation import, source tracing, context export and expiration work through the UI', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/memory/');
  await page.getByRole('tab', { name: /^对话/ }).click();
  await page.getByRole('button', { name: '粘贴对话', exact: true }).click();
  await page.getByLabel('对话标题', { exact: true }).fill('写作偏好讨论');
  await page
    .getByLabel('对话内容', { exact: true })
    .fill('## user\n请记住，我喜欢清晰的中文解释。\n\n## assistant\n好的。');
  await page.getByRole('button', { name: '预览导入', exact: true }).click();
  await page.getByRole('button', { name: '确认导入', exact: true }).click();
  await expect(page.locator('.mw-conversation-row')).toHaveCount(1);
  await page.getByRole('button', { name: '写作偏好讨论', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('请记住，我喜欢清晰的中文解释。');
  await expect(page.locator('.mw-message.user')).toHaveCount(1);
  await expect(page.locator('.mw-message.assistant')).toHaveCount(1);
  await page.getByRole('button', { name: '从此对话提炼记忆' }).click();
  await page.getByLabel('标题', { exact: true }).fill('中文解释偏好');
  await page.getByLabel('摘要', { exact: true }).fill('解释复杂问题时，优先用清晰的中文。');
  await page.getByRole('combobox', { name: '类型', exact: true }).selectOption('preference');
  await page.getByLabel('项目', { exact: true }).fill('个人写作');
  await page.getByLabel('标签', { exact: true }).fill('中文, 写作');
  await page.getByRole('button', { name: '保存记忆', exact: true }).click();
  await page.getByRole('tab', { name: /^记忆/ }).click();
  await page.getByLabel('搜索记忆').fill('中文');
  await expect(page.getByText('中文解释偏好', { exact: true })).toBeVisible();
  await page.getByLabel('选择记忆：中文解释偏好', { exact: true }).check();
  await expect(page.getByLabel('上下文预览')).toContainText('来源：写作偏好讨论');
  await page.getByRole('button', { name: '复制上下文', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('中文解释偏好');
  const contextDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 Markdown', exact: true }).click();
  expect(await downloadedText(await contextDownload)).toContain('来源：写作偏好讨论');
  await page.getByRole('button', { name: '编辑记忆：中文解释偏好' }).click();
  await page.getByRole('combobox', { name: '状态', exact: true }).selectOption('expired');
  await page.getByRole('button', { name: '保存记忆', exact: true }).click();
  await expect(page.getByRole('button', { name: '复制上下文', exact: true })).toBeDisabled();
  await page.getByLabel('筛选记忆状态').selectOption('expired');
  await expect(page.getByText('中文解释偏好', { exact: true })).toBeVisible();
  await expect(page.getByLabel('选择记忆：中文解释偏好', { exact: true })).toBeDisabled();
});

test('backup restores into a fresh browser, duplicate import is harmless, invalid input keeps saved data', async ({
  page,
  browser,
}) => {
  await page.goto('/memory/');
  await page.getByRole('button', { name: '新建记忆', exact: true }).first().click();
  await page.getByLabel('标题', { exact: true }).fill('可恢复的记忆');
  await page.getByLabel('摘要', { exact: true }).fill('备份以后能恢复。');
  await page.getByRole('button', { name: '保存记忆', exact: true }).click();
  await page.getByRole('tab', { name: /^备份/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 JSON 备份' }).click();
  const backupText = await downloadedText(await downloadPromise);
  expect(JSON.parse(backupText).memories).toHaveLength(1);
  const freshContext = await browser.newContext();
  const fresh = await freshContext.newPage();
  await fresh.goto(new URL('/memory/', page.url()).href);
  await expect(fresh.getByRole('button', { name: '新建记忆', exact: true }).first()).toBeEnabled();
  for (let repeat = 0; repeat < 2; repeat++) {
    await fresh.getByLabel('选择导入文件').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backupText),
    });
    await fresh.getByRole('button', { name: '确认导入', exact: true }).click();
    await expect(fresh.locator('.mw-card')).toHaveCount(1);
  }
  await fresh.getByLabel('选择导入文件').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":2}'),
  });
  await expect(fresh.getByRole('alert')).toContainText('导入未完成');
  await expect(fresh.getByText('可恢复的记忆', { exact: true })).toBeVisible();
  await fresh.reload();
  await expect(fresh.getByText('可恢复的记忆', { exact: true })).toBeVisible();
  await freshContext.close();
});

test('imported HTML stays plain text and deleting a conversation detaches its memory source', async ({
  page,
}) => {
  await page.goto('/memory/');
  await expect(page.getByRole('button', { name: '新建记忆', exact: true }).first()).toBeEnabled();
  await page.getByLabel('选择导入文件').setInputFiles({
    name: 'source.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(
      '## user\n<img src=x onerror="window.privateXss=true">\n## assistant\n原文应显示为文本。',
    ),
  });
  await page.getByRole('button', { name: '确认导入', exact: true }).click();
  await page.getByRole('button', { name: 'source', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    '<img src=x onerror="window.privateXss=true">',
  );
  await expect(page.getByRole('dialog').locator('img')).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as Window & { privateXss?: boolean }).privateXss),
  ).toBeUndefined();
  await page.getByRole('button', { name: '从此对话提炼记忆' }).click();
  await page.getByLabel('标题', { exact: true }).fill('保留原文来源');
  await page.getByLabel('摘要', { exact: true }).fill('原文按文本展示。');
  await page.getByRole('button', { name: '保存记忆', exact: true }).click();
  await page.getByRole('tab', { name: /^对话/ }).click();
  await page.getByRole('button', { name: '删除对话：source' }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.locator('.mw-conversation-row')).toHaveCount(0);
  await page.getByRole('tab', { name: /^记忆/ }).click();
  await expect(page.getByText('保留原文来源', { exact: true })).toBeVisible();
  await expect(page.locator('.mw-card-source')).toHaveCount(0);
});

test('private workspace and editor fit a narrow phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/memory/');
  await page.getByRole('button', { name: '新建记忆', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const box = await page.getByRole('dialog').boundingBox();
  expect(box!.width).toBeLessThanOrEqual(375);
});

test('tag and inclusive UTC update dates filter without changing saved memories or context', async ({
  page,
}) => {
  const shared = {
    summary: '日期筛选测试',
    kind: 'fact',
    status: 'active',
    project: '筛选项目',
    tags: ['中文'],
    createdAt: '2026-10-01',
    sourceRefs: [],
  };
  const backup = {
    version: 1,
    memories: [
      { ...shared, id: 'older', title: 'UTC 五日记忆', updatedAt: '2026-10-06T00:30:00+02:00' },
      { ...shared, id: 'newer', title: 'UTC 六日记忆', updatedAt: '2026-10-05T23:30:00-02:00' },
      {
        ...shared,
        id: 'other-tag',
        title: '相似标签记忆',
        tags: ['中文写作'],
        updatedAt: '2026-10-06',
      },
    ],
    conversations: [
      {
        id: 'older-source',
        title: 'UTC 五日对话',
        source: 'backup',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-06T00:30:00+02:00',
        messages: [],
      },
      {
        id: 'newer-source',
        title: 'UTC 六日对话',
        source: 'backup',
        createdAt: '2026-10-01',
        updatedAt: '2026-10-05T23:30:00-02:00',
        messages: [],
      },
    ],
  };
  await page.goto('/memory/');
  await expect(page.getByRole('button', { name: '新建记忆', exact: true }).first()).toBeEnabled();
  await page.getByLabel('选择导入文件').setInputFiles({
    name: 'dated-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole('button', { name: '确认导入', exact: true }).click();
  await expect(page.locator('.mw-card h3')).toHaveText([
    'UTC 六日记忆',
    '相似标签记忆',
    'UTC 五日记忆',
  ]);
  await page.getByLabel('选择记忆：UTC 五日记忆', { exact: true }).check();
  await page.getByLabel('筛选标签', { exact: true }).selectOption('中文');
  await expect(page.locator('.mw-card')).toHaveCount(2);
  await page.getByLabel('更新自', { exact: true }).fill('2026-10-06');
  await page.getByLabel('更新至', { exact: true }).fill('2026-10-06');
  await expect(page.locator('.mw-card h3')).toHaveText(['UTC 六日记忆']);
  await expect(page.getByLabel('上下文预览')).toContainText('UTC 五日记忆');
  await page.getByLabel('更新自', { exact: true }).fill('2026-10-07');
  await expect(page.getByRole('alert')).toContainText('更新自不能晚于更新至');
  await page.getByRole('button', { name: '清除筛选', exact: true }).click();
  await expect(page.getByLabel('筛选标签', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('更新自', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('更新至', { exact: true })).toHaveValue('');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.mw-card')).toHaveCount(3);
  await expect(page.getByLabel('选择记忆：UTC 五日记忆', { exact: true })).toBeChecked();
  await page.getByRole('tab', { name: /^对话/ }).click();
  await expect(page.locator('.mw-conversation-title')).toHaveText(['UTC 六日对话', 'UTC 五日对话']);
  await page.reload();
  await expect(page.locator('.mw-card')).toHaveCount(3);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
