# Charming · 个人博客

以文章阅读为核心的个人博客，部署在 <https://charming-liu07.github.io>。

视觉采用粉色、纸白与深灰配色，搭配等宽标签、细线边框和克制的终端元素。首页、文章、归档、标签、搜索与关于页面使用同一套响应式布局，支持深浅主题、键盘导航和减少动态效果偏好。

## 本地开发

需要 Node.js 22.12 或以上，建议 Node.js 24。

```sh
npm ci
npm run dev
```

## 验证

```sh
npm run check
npm test
```

`npm test` 会构建静态站点和 Pagefind 索引，再检查原文章内容、公开路由、订阅、站点地图、内部链接及静态资源。对已有构建单独检查可运行 `npm run test:site`。

浏览器测试使用本机 Chrome，CI 使用 Chromium。测试构建版本：

```powershell
$env:PW_PREVIEW = '1'
npm run test:browser
```

`npm run preview` 可预览 `dist/`。全文搜索索引在构建后生成，开发模式下可通过归档浏览文章。

## 发布文章

在 `src/content/blog/` 添加 Markdown 文件，例如 `first-note.md`：

```markdown
---
title: 第一篇笔记
description: 这篇文章的简短介绍。
date: 2026-10-09
tags: [随笔]
---

正文从这里开始。
```

文章地址为 `/post/first-note/`。首页、文章列表、归档、标签、全文搜索和 Atom 订阅会自动更新。不要在正文中重复添加一级标题，文章标题由模板输出。

原《关于》文章的内容、日期和 `/post/about/` 地址完整保留。本站不使用账户、云数据库或第三方统计脚本。

## GitHub Pages

合并到 `main` 后，`.github/workflows/deploy.yml` 执行类型检查、构建和站点验证，再部署 `dist/`。仓库 Pages 的 Source 使用 **GitHub Actions**。PR 的 `ci.yml` 还会检查浏览器中的导航、主题、搜索和响应式布局。

## 文件职责

- `src/content/blog/`：Markdown 文章。
- `src/pages/`：首页、文章列表、归档、标签、搜索、关于、文章和订阅。
- `src/layouts/SiteLayout.astro`：导航、主题、元数据和页脚。
- `src/components/`、`src/styles/`：共用视觉组件和样式。
- `tests/blog.test.mjs`：静态发布产物验证。
- `tests/browser/`：浏览器行为与可读性检查。
- `public/`：原头像与静态资源。
