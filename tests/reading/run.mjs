import { spawnSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = new URL('../../src/content/blog/reading-navigation-fixture.md', import.meta.url);
const paragraph =
  '这是一段仅用于阅读交互测试的长文内容。段落保留足够的阅读距离，让目录定位、滚动和窗口变化都能在真实页面中得到验证。';
const body = Array.from({ length: 5 }, (_, index) => {
  const heading = index === 1 || index === 3 ? '###' : '##';
  return `${heading} 阅读章节 ${index + 1}\n\n${Array(8).fill(paragraph.repeat(3)).join('\n\n')}`;
}).join('\n\n');
const markdown = `---
title: 长文目录测试
description: '</script><script id="metadata-escape">window.metadataEscape=true</script>'
date: 2024-11-01
updated: 2026-10-10
tags: []
---

这是构建后立即从源目录移除的测试文章，不应进入发布构建。

${body}

#### 不进入目录的四级标题

${paragraph}
`;

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

let created = false;
let status;
try {
  // Never overwrite an existing article, even if someone used this reserved test name.
  writeFileSync(fixture, markdown, { flag: 'wx' });
  created = true;
  status = run(['node_modules/astro/bin/astro.mjs', 'build', '--outDir', '.reading-dist']);
} finally {
  if (created) unlinkSync(fixture);
}

// The browser only sees the isolated build; the source fixture is already gone.
if (status === 0) {
  status = run([
    'node_modules/@playwright/test/cli.js',
    'test',
    '--config',
    'tests/reading/playwright.config.ts',
    ...process.argv.slice(2),
  ]);
}
process.exitCode = status;
