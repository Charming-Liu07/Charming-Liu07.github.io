# Charming · 文字与记忆

个人博客与浏览器本机 AI 对话记忆库，部署地址为 <https://charming-liu07.github.io>。

## 开发与验证

需要 Node.js 22.12 或以上，建议 Node.js 24。

```sh
npm ci
npm run dev
```

```sh
npm test
npm run check
npm run build
npm run preview
```

浏览器测试使用本机 Chrome；CI 使用 Playwright Chromium：

```sh
npm run test:browser
```

PowerShell 下测试构建版本：

```powershell
$env:PW_PREVIEW = '1'
npm run test:browser
```

构建输出在 `dist/`，包含博客页面、Atom、sitemap 和 Pagefind 公开文章索引。私有记忆页面不进入公开全文索引。

## 发布文章

在 `src/content/blog/` 添加 Markdown，例如 `first-note.md`：

```markdown
---
title: 第一篇笔记
description: 这篇文章的简短介绍。
date: 2026-10-06
tags: [随笔]
---

正文从这里开始。
```

发布后文章地址为 `/post/first-note/`。首页、归档、标签、文章页、搜索和 Atom 订阅由同一内容集合生成。原《关于》正文和日期已迁移到 `src/content/blog/about.md`，原地址 `/post/about/` 保留。

## 使用记忆库

打开 `/memory/`。对话和记忆只保存在**当前浏览器、当前网站地址**的 IndexedDB 中，初次打开为空。不同浏览器、设备以及本机预览和正式域名各有独立数据。

1. 通过“粘贴对话”或“导入文件”保存对话。
2. 将对话中的偏好、事实、决定、经验整理成记忆卡片；关联来源，填写项目和标签。
3. 搜索并勾选当前需要的有效记忆，复制上下文或下载 Markdown，供新 AI 对话使用。
4. 在“备份”中导出完整 JSON；换设备或浏览器时导入备份，确认后合并。重复导入不会重复记录，相同 ID 保留较新的版本。

记忆卡片可按关键词、类型、项目、标签和更新日期范围筛选。日期范围包含起止当天，按 UTC 日期计算。

把记忆标为过期后，它仍可查看，但不会进入上下文导出。删除对话时，记忆卡片保留，相关来源引用移除。删除数据有界面确认；导入校验失败不会改动现有数据。

请定期下载备份：清除站点数据、浏览器配置或卸载浏览器会影响本机保存的数据。本站不提供云同步、账户登录、自动抓取聊天或后台模型调用。本机存储不是加密保险箱；同源脚本可以读取它，项目不引入第三方分析或远程脚本。

## 导入格式

支持本站导出的版本 1 JSON，以及 Markdown / TXT 对话。JSON 先校验全部内容，再等待用户确认合并；不接受不明结构的平台导出文件。

Markdown 可用以下角色标题（也识别中文“用户”“助手”“系统”）：

```markdown
## user

请记住，我喜欢清晰的中文解释。

## assistant

好的，后续解释会尽量清晰。
```

没有角色标题的文本会作为一条用户消息导入。BOM 和 Windows 换行均支持；相同文本再次导入会去重。导入内容按文本展示，不能执行其中的 HTML 或脚本。

完整备份形状：

```json
{
  "version": 1,
  "conversations": [],
  "memories": []
}
```

来源对话保存标题、来源、时间、消息角色和正文。记忆保存摘要、类型、项目、标签、更新时间、有效/过期状态和来源引用。具体字段定义见 `src/lib/memory/types.ts`。

## 将记忆整理成公开文章

导出选定记忆的 Markdown，审阅并编辑，再加入 `src/content/blog/` 发布。原始对话不会随博客构建上传。工作台不保存 GitHub 令牌，也不会在网页中自动提交内容。

## GitHub Pages 部署

1. 合并重构分支到 `main`。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. `deploy.yml` 在 `main` 更新时测试、构建并部署 `dist/`；手动执行也只允许 `main` 分支。

PR 自动执行 `ci.yml` 的单元测试、类型检查、构建与浏览器测试，不部署。Pages 首次部署需要仓库配置支持 GitHub Actions；页面里显示“已保存”只代表本机保存成功。

官方部署说明：<https://docs.astro.build/en/guides/deploy/github/>。

## 文件职责

- `src/content/blog/`：公开文章，版本由 Git 管理。
- `src/pages/`、`src/layouts/`：博客页面与共用导航。
- `src/lib/memory/`：本机数据模型、校验、导入导出与事务存储。
- `src/components/memory/`：私有记忆工作台。
- `tests/`：核心数据与浏览器行为测试。
- `public/`：原头像、图标和本地静态资源。

原静态导出保存在 Git 历史中，可以通过重构前提交 `c2fb50aaa52aac323eae4157306b29cbe0ab8a04` 查阅。
