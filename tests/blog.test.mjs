import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('../dist/', import.meta.url);
const routes = ['/', '/blog/', '/archives/', '/tags/', '/about/', '/search/', '/post/about/'];
const htmlFor = (route) => readFile(new URL(`.${route}index.html`, output), 'utf8');

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
  const sitemap = await readFile(new URL('sitemap-0.xml', output), 'utf8');
  assert.match(sitemap, /\/post\/about\//);
  assert.doesNotMatch(sitemap, /\/memory\//);
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
