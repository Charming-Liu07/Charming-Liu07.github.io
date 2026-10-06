# Blog and Local AI Memory Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement these bounded tasks, with focused review and final integration. Steps use checkboxes for tracking.

**Goal:** Replace the static export with a maintained personal blog and an entirely local conversation memory workspace.

**Architecture:** Astro renders public Markdown articles and common navigation. A React island at `/memory/` manages IndexedDB records and has no network writes. Public search only indexes public pages; the memory workspace searches private records in the browser.

**Tech Stack:** Astro 7, React 19, TypeScript, IndexedDB, Pagefind, Node test runner with tsx, Playwright for development verification.

## Global Constraints

- Public site URL is `https://charming-liu07.github.io`; no base path.
- Chinese interface; mobile and keyboard usable; persistent light/dark theme.
- Preserve `/archives/`, `/tags/`, `/post/about/`, `/atom.xml`, existing avatar and favicon. Preserve the sole original article's content and date `2024-11-02`.
- Raw conversations and memory entries remain in the current browser. No model calls, credentials, analytics, remote storage, or automatic public publishing.
- Imports are all-or-nothing after validation; backup is versioned; duplicate import is idempotent. Imported user text is rendered as text, never raw HTML.
- Active memories can be selected and copied/exported with source titles and updated dates. Expired memories do not enter context output.
- Fresh memory workspace starts empty and never invents personal history.

## Shared Interfaces

`src/lib/memory/types.ts` exports:

```ts
export type Role = 'user' | 'assistant' | 'system';
export type MemoryKind = 'fact' | 'preference' | 'decision' | 'learning';
export type MemoryStatus = 'active' | 'expired';
export interface Message { id: string; role: Role; content: string }
export interface Conversation { id: string; title: string; source: string; createdAt: string; updatedAt: string; messages: Message[] }
export interface SourceRef { conversationId: string; messageIds: string[] }
export interface MemoryEntry { id: string; title: string; summary: string; kind: MemoryKind; project: string; tags: string[]; status: MemoryStatus; createdAt: string; updatedAt: string; sourceRefs: SourceRef[] }
export interface Library { version: 1; conversations: Conversation[]; memories: MemoryEntry[] }
```

`src/lib/memory/core.ts` exports `emptyLibrary(): Library`, `validateLibrary(input: unknown): Library`, `parseImport(text: string, filename: string, now?: string): Promise<Library>`, `mergeLibraries(existing: Library, incoming: Library): Library`, `filterMemories(entries: MemoryEntry[], filters: {query?: string; kind?: string; status?: string; project?: string}): MemoryEntry[]`, `buildContext(entries: MemoryEntry[], library: Library): string`, and `exportBackup(library: Library): string`.

`parseImport` accepts JSON version-1 backups and plain `.md`/`.txt` conversations. Markdown recognizes `## user`, `## assistant`, `## system` and Chinese equivalents; unmarked text is one user message. Normalize BOM/CRLF; stable IDs derived from imported text make duplicate text imports idempotent. JSON rejects invalid dates, duplicate IDs and missing conversation/message references. Merge retains the newer updated record for a shared ID, then validates the complete result.

`src/lib/memory/storage.ts` exports `readLibrary(): Promise<Library>` and `updateLibrary(updater: (current: Library) => Library): Promise<Library>`. Use an IndexedDB read-write transaction for read/update/write of one versioned library record, rejecting storage errors without reporting success. React must wait for database hydration before editing. Re-read on browser focus; local state is never included in Astro props.

`src/layouts/SiteLayout.astro` accepts `{ title: string; description?: string; active?: 'home'|'blog'|'memory'|'about'; fullWidth?: boolean }`; wraps the application with the shared sidebar, search control, footer, and theme switch. `src/components/Icon.astro` accepts `{ name: string; size?: number; class?: string }`.

`src/content.config.ts` defines `blog` with `title`, `description`, `date`, and `tags`; `src/content/blog/about.md` is the original article. Routes consume this single collection.

### Task 1: Core local data and backup behavior

**Files:** `src/lib/memory/{types,core,storage}.ts`, `tests/memory.test.ts`.

**Produces:** Shared memory APIs above. No React, route, global stylesheet, or package configuration edits.

- [ ] Write tests before implementation: invalid backup fails, conversation import preserves roles and order, BOM/CRLF parse, identical text and backup imports do not duplicate, corrupted references are rejected, newer merge survives, expired entry excluded from context, source trace included, backup round trip retains fields.
- [ ] Run `npm test` and record expected missing-behavior failures.
- [ ] Implement types, validation, text import, merge, filters and exports; keep text plain.
- [ ] Run `npm test`; all assertions pass.
- [ ] Implement atomic IndexedDB storage with validation and surfaced errors; verify in browser integration.

Example acceptance assertion:

```ts
const imported = await parseImport('## user\n你好\n## assistant\n你好！', 'session.md');
assert.deepEqual(imported.conversations[0].messages.map(m => m.role), ['user', 'assistant']);
assert.equal(mergeLibraries(imported, imported).conversations.length, 1);
```

### Task 2: Private memory workspace

**Files:** `src/components/memory/MemoryWorkspace.tsx`, `src/components/memory/memory.css`, `src/pages/memory/index.astro`.

**Consumes:** Memory APIs and SiteLayout. No core/schema/global layout edits.

- [ ] Implement tabbed memory / conversation / backup workspace with accessible labels and clear empty states.
- [ ] Create/edit/delete cards with title, summary, kind, project, comma separated tags, active/expired status and optional source conversation selection.
- [ ] Paste conversations and import `.json`/`.md`/`.txt` through `parseImport`; display validation failure or import counts; merge only after explicit import action.
- [ ] Search/filter private entries, inspect source conversations and role-labelled messages, allow deriving a memory from a chosen conversation.
- [ ] Selected active memories produce a source-linked context preview; copy and download Markdown.
- [ ] Full JSON backup export and merge restore; acknowledge local-only persistence and backup need using short product copy.
- [ ] Confirm delete actions in the UI; deleting a conversation keeps memory cards but detaches its source references with a visible explanation.
- [ ] Refresh state after writes; surface storage errors; loading state disables editing; handle focus refresh.
- [ ] Run `npm run check`; verify in a real browser with integration tests after core integration.

### Task 3: Public blog and content migration

**Files:** `src/content.config.ts`, `src/content/blog/about.md`, `src/pages/{index,blog/index,post/[...slug],archives/index,tags/index,about/index,search/index,404}.astro`, `src/pages/atom.xml.ts`, `src/components/ArticleCard.astro`.

**Consumes:** Shared SiteLayout, Icon and global styles. No memory/schema files or global layout edits.

- [ ] Render all public article listings, tags, archive and feed from the blog collection.
- [ ] Migrate the sole original article exactly, keeping its date and `/post/about/`.
- [ ] Build a distinctive Chinese home page with personal introduction, latest writing and local memory entry; never show fabricated history/counts.
- [ ] Add article detail typography, table of contents, tag links, code highlight and back navigation.
- [ ] Add Pagefind search route, about overview, RSS feed, canonical metadata, sitemap and helpful 404.
- [ ] Run `npm run check` and `npm run build`; verify legacy routes exist and private records are absent from output.

### Task 4: Controller integration, verification and delivery

**Files:** `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/layouts/SiteLayout.astro`, `src/components/Icon.astro`, `src/styles/global.css`, `public/*`, `.github/workflows/{ci,deploy}.yml`, `tests/browser.spec.ts`, `README.md`.

- [ ] Set up pinned dependencies and lockfile, strict type check, core tests, static build and public search index.
- [ ] Copy original resources into `public/`; remove legacy root-generated files only after migration and output checks.
- [ ] Implement shared visual system: graphite text, warm off-white surface, teal accent, readable Chinese typography, sidebar desktop/navigation mobile and dark mode.
- [ ] Add GitHub Actions checks for PRs; deployment only from merged main. Explain Pages source setting in README.
- [ ] Browser test through public UI: create conversation, derive memory, reload persistence, search, expire/context exclusion, export/restore, invalid import, HTML text safety and mobile navigation. Never use a user's personal memory as a test fixture.
- [ ] Check build output contains only the migrated public article and site documentation; ensure private UI is excluded from Pagefind.
- [ ] Obtain focused task reviews and final whole-branch review; fix important findings and re-run affected checks.
- [ ] Commit complete implementation, create draft PR through GitHub connection, attach it to chat, open local preview, export source bundle and user instructions under `outputs/`.

**Completion evidence:** `npm test`, `npm run check`, `npm run build`, browser test report, reviewed diff, a verified draft PR and source bundle. Live deployment is separate from draft PR creation.
