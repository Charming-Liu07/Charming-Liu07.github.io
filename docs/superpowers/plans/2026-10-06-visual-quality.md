# Visual Quality Implementation Plan

> For agentic workers: use scoped subagent implementation and independent final review. Parent owns integration and release.

**Goal:** Give the existing public blog and private local memory workspace a coherent, original editorial identity and polished responsive interactions.

**Architecture:** Keep Astro public pages and React local storage behavior. Improve shared design tokens/layout, original homepage scene, public reading styles and memory interaction surfaces; use a small native motion module.

**Tech Stack:** Existing Astro, React, TypeScript, CSS, SVG and Playwright. No new runtime packages or remote assets.

## Global constraints

Use the companion design document's privacy, route preservation, typography, contrast, 44px targets, no-JS visibility and reduced-motion requirements. Base production commit c885d063215d6d45719fd26498b2719824b49344; isolated branch codex/visual-polish.

## Task 1: Shared typography, color, rhythm and navigation

- Parent owns src/styles/global.css, src/layouts/SiteLayout.astro and src/scripts/site-motion.ts.
- Correct light/dark contrast, type scale, content spacing, touch targets, keyboard focus and shared link/button feedback. Keep semantic navigation and theme persistence.
- Add small progressive enhancement module for entering elements and pointer-sensitive decorative art, gated by reduced-motion and fine pointer media queries. Show all content before script, and when JS is unavailable.

## Task 2: Original homepage and public reading details

- Scoped implementer owns src/pages/index.astro, src/components/ArticleCard.astro, new src/components/MemoryScene.astro and owned public route styles.
- Make homepage composition and paper/memory motif distinctive across desktop/mobile, increase readable descriptive text, and provide clear article and workspace pathways.
- Improve article/list/detail/empty/search typography and rhythm while keeping migration content, URLs and search behavior. No artificial article counts or generated personal history.

## Task 3: Memory workspace usability and visual coherence

- Scoped implementer owns src/components/memory/memory.css and presentation-only component markup as necessary; no core/storage/schema edits.
- Improve card/editor/filter/tab/context surfaces, contrast, target sizes, visual feedback, wrapping and phone layouts. Keep all imports/source/context/backup workflows.

## Task 4: Verification, iterative review and release

- Add meaningful browser acceptance for readable type, contrast, touch targets, multiple widths, keyboard, reduced motion/no-JS and any new interactive behavior. Visual-only adjustments use screenshot verification rather than implementation-mirroring unit tests.
- Run npm test, npm run check, npm run build, production browser suite and formatting check sequentially to avoid Windows Vite lock conflicts.
- Capture real light/dark desktop, phone, article and memory screenshots. Independent review must identify concrete defects against the eight dimensions. Fix findings and recheck affected cases until none remains.
- Create and attach review PR; existing publication authorization permits merge after CI passes. Wait for Pages deployment, verify public site and update user-facing screenshots/report/source bundle under outputs.
