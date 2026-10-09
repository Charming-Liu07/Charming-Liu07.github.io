# Personal blog reading and sharing improvements

**Goal:** Give Charming's existing blog a truthful personal identity, faster access to articles, complete sharing previews, and usable long-article navigation while retaining its pink/charcoal terminal-inspired design.

**Approved direction:** The user asked to implement the preceding improvement recommendations and supplied this biography: a first-year university student who likes badminton, AI, and programming, and writes about emotional experiences, AI, programming, software, and game resources.

**Architecture:** Keep the static Astro site and Markdown content workflow. Use one local brand PNG for reliable social previews, article-specific metadata, and a small progressively enhanced TOC component. No new service, login, CMS, or fabricated article is needed.

## Constraints

- Preserve the original about.md byte content, date, and /post/about/ URL.
- Preserve RSS, Pagefind, theme persistence, accessible navigation, no-JavaScript reading, and reduced-motion support.
- Keep the existing pink #f386a1, charcoal #1e1e1e and paper #fefefe visual language.
- Use only user-provided identity and interests; no invented achievements, projects, email, or university name.
- Do not restore memory features or publish test fixtures as real content.
- Verify and review before publishing; continue the previously authorized merge/deploy workflow for this site.

## Task 1: Homepage and biography

- [ ] Compact the hero on desktop and phones; keep its recognizable typography and terminal illustration.
- [ ] Show latest article titles earlier on a typical phone screen.
- [ ] Use the supplied biography on the homepage and about page. Show writing interests without empty category links.
- [ ] Keep the existing first-post date, avatar, original welcome text, GitHub, and RSS links.
- [ ] Verify responsive layout, no overflow, target sizes, contrast and no-JS reading using the existing browser suite.

## Task 2: Sharing and publication metadata

- [ ] Add a deterministic local 1200x630 PNG brand card and inspect it visually.
- [ ] Make page titles, canonical links, OG/Twitter image URLs and image metadata consistent.
- [ ] Give articles the article type and their own publication/update metadata and safe structured data.
- [ ] Support an optional updated date without changing the original article.
- [ ] Add focused build-output checks for actual metadata, valid image dimensions and preserved content.

## Task 3: Long-article navigation

- [ ] Extract a TOC component that only appears when relevant headings exist.
- [ ] Retain desktop access, collapse the enhanced phone TOC, track the current section, and support keyboard/native links.
- [ ] Keep readable TOC/navigation when JavaScript is disabled.
- [ ] Verify interactions against an isolated long-article fixture that never enters the release build or source content.

## Integration and release

- [ ] Run type checks, static build checks and browser tests; inspect the final source diff.
- [ ] Obtain an independent code review and resolve material findings.
- [ ] Create and attach a PR against the current remote main, verify exact-head CI, merge and follow deployment.
- [ ] Confirm the production homepage biography, original article, share image and metadata; /memory/ remains 404.
