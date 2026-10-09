import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('../dist/', import.meta.url);
const routes = ['/', '/blog/', '/archives/', '/tags/', '/about/', '/search/', '/post/about/'];
const htmlFor = (route) => readFile(new URL(`.${route}index.html`, output), 'utf8');
const site = 'https://charming-liu07.github.io';
const socialImage = `${site}/images/social-card.png`;
const metaContent = (html, name) =>
  html.match(new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`))?.[1];

test('public pages share consistent titles, canonical URLs and large image previews', async () => {
  for (const route of routes) {
    const html = await htmlFor(route);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const canonical = `${site}${route}`;
    assert.ok(title, `${route}: page title exists`);
    if (route === '/') assert.equal(title, 'Charming · 个人博客');
    assert.equal(metaContent(html, 'og:title'), title, `${route}: OG title matches page`);
    assert.equal(metaContent(html, 'twitter:title'), title, `${route}: Twitter title matches page`);
    assert.equal(metaContent(html, 'og:description'), metaContent(html, 'description'), route);
    assert.equal(metaContent(html, 'twitter:description'), metaContent(html, 'description'), route);
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}"`), route);
    assert.equal(metaContent(html, 'og:url'), canonical, route);
    assert.equal(metaContent(html, 'og:type'), route.startsWith('/post/') ? 'article' : 'website', route);
    assert.equal(metaContent(html, 'og:image'), socialImage, route);
    assert.equal(metaContent(html, 'og:image:type'), 'image/png', route);
    assert.equal(metaContent(html, 'og:image:width'), '1200', route);
    assert.equal(metaContent(html, 'og:image:height'), '630', route);
    assert.equal(metaContent(html, 'og:image:alt'), 'Charming 个人博客，粉色像素 C_ 终端标志', route);
    assert.equal(metaContent(html, 'twitter:card'), 'summary_large_image', route);
    assert.equal(metaContent(html, 'twitter:image'), socialImage, route);
    assert.equal(metaContent(html, 'twitter:image:alt'), metaContent(html, 'og:image:alt'), route);
  }
});

test('the published sharing card is the local 1200 by 630 PNG', async () => {
  const source = await readFile(new URL('public/images/social-card.png', root));
  const published = await readFile(new URL('images/social-card.png', output));
  assert.deepEqual(published, source, 'the local sharing card is copied into the static build');
  assert.deepEqual(published.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(published.toString('ascii', 12, 16), 'IHDR');
  assert.equal(published.readUInt32BE(16), 1200);
  assert.equal(published.readUInt32BE(20), 630);
  assert.ok(published.byteLength > 1000, 'the PNG contains rendered image data');
});

test('the original article publishes truthful BlogPosting metadata without an invented update', async () => {
  const html = await htmlFor('/post/about/');
  const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(json, 'article structured data exists');
  const article = JSON.parse(json);
  assert.equal(article['@context'], 'https://schema.org');
  assert.equal(article['@type'], 'BlogPosting');
  assert.equal(article.headline, '关于');
  assert.equal(article.description, '欢迎来到我的小站呀，很高兴遇见你！🤝');
  assert.equal(article.url, `${site}/post/about/`);
  assert.equal(article.datePublished, '2024-11-02T00:00:00.000Z');
  assert.equal(article.dateModified, undefined);
  assert.equal(article.image, socialImage);
  assert.deepEqual(article.author, { '@type': 'Person', name: 'Charming', url: `${site}/about/` });
  assert.equal(metaContent(html, 'article:published_time'), article.datePublished);
  assert.equal(metaContent(html, 'article:modified_time'), undefined);
  assert.doesNotMatch(await htmlFor('/'), /application\/ld\+json|article:published_time|article:modified_time/);
});

test('the original article keeps its content, date and public URL', async () => {
  const source = await readFile(new URL('src/content/blog/about.md', root), 'utf8');
  assert.equal(
    source.replaceAll('\r\n', '\n'),
    '---\ntitle: 关于\ndescription: 欢迎来到我的小站呀，很高兴遇见你！🤝\ndate: 2024-11-02\ntags: []\n---\n\n> 欢迎来到我的小站呀，很高兴遇见你！🤝\n\n<!-- more -->\n\n24/11/2\n',
  );
  const article = await htmlFor('/post/about/');
  assert.match(article, /欢迎来到我的小站呀，很高兴遇见你！🤝/);
  assert.match(article, /2024-11-02/);
  assert.match(article, /24\/11\/2/);
  assert.match(article, /data-pagefind-body/);
  assert.match(article, /https:\/\/charming-liu07\.github\.io\/post\/about\//);
});

test('all public routes have an accessible, linked blog shell', async () => {
  for (const route of routes) {
    const html = await htmlFor(route);
    assert.match(html, /<html[^>]*lang="zh-CN"/, route);
    assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1, `${route} has one main heading`);
    assert.match(html, /id="main-content"/, route);
    assert.match(html, /href="#main-content"/, route);
    assert.match(html, /rel="canonical"/, route);
    assert.match(html, /name="description" content="[^"]+"/, route);
    assert.match(html, /href="\/blog\/"/, route);
    assert.match(html, /href="\/about\/"/, route);
    assert.match(html, /href="\/atom.xml"/, route);
  }
});

test('memory routes, workspace and client dependencies are absent from the published site', async () => {
  await assert.rejects(stat(new URL('memory/index.html', output)), { code: 'ENOENT' });
  await assert.rejects(stat(new URL('post/reading-navigation-fixture/index.html', output)), {
    code: 'ENOENT',
  });
  for (const route of routes) {
    const html = await htmlFor(route);
    assert.doesNotMatch(
      html,
      /\/memory\/|记忆库|MemoryWorkspace|data-memory-scene|astro-island/,
      route,
    );
  }
  const config = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  for (const name of [
    'react',
    'react-dom',
    '@astrojs/react',
    'fake-indexeddb',
    'oxc-transform-react',
  ]) {
    assert.ok(!config.dependencies?.[name] && !config.devDependencies?.[name], name);
  }
});

test('Atom, sitemap and Pagefind keep the original published article', async () => {
  const feed = await readFile(new URL('atom.xml', output), 'utf8');
  assert.match(feed, /<title>关于<\/title>/);
  assert.match(feed, /2024-11-02T00:00:00.000Z/);
  assert.match(feed, /https:\/\/charming-liu07\.github\.io\/post\/about\//);
  assert.doesNotMatch(feed, /文字与记忆|\/memory\//);
  assert.doesNotMatch(feed, /reading-navigation-fixture/);
  const sitemap = await readFile(new URL('sitemap-0.xml', output), 'utf8');
  assert.match(sitemap, /\/post\/about\//);
  assert.doesNotMatch(sitemap, /\/memory\//);
  assert.doesNotMatch(sitemap, /reading-navigation-fixture/);
  await stat(new URL('pagefind/pagefind.js', output));
});

test('published internal links, fragments and assets resolve', async () => {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith('.html')) files.push(file);
    }
  }
  await walk(fileURLToPath(output));
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    const relative = path.relative(fileURLToPath(output), file);
    for (const match of html.matchAll(/\b(?:href|src)="([^"<>]+)"/g)) {
      const value = match[1].replaceAll('&amp;', '&');
      if (value.startsWith('#')) {
        const id = decodeURIComponent(value.slice(1));
        assert.ok(html.includes(`id="${id}"`), `${relative}: ${value} fragment exists`);
        continue;
      }
      if (!value.startsWith('/') || value.startsWith('//')) continue;
      const url = new URL(value, 'https://charming-liu07.github.io');
      const pathname = decodeURIComponent(url.pathname);
      const destination = new URL(
        `.${pathname}${pathname.endsWith('/') ? 'index.html' : ''}`,
        output,
      );
      await assert.doesNotReject(stat(destination), `${relative}: ${value}`);
      if (url.hash && destination.pathname.endsWith('.html')) {
        const target = await readFile(destination, 'utf8');
        const id = decodeURIComponent(url.hash.slice(1));
        assert.ok(target.includes(`id="${id}"`), `${value} fragment exists`);
      }
    }
  }
});
