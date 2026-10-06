import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

const escapeXml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (character) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!,
  );

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL('https://charming-liu07.github.io');
  const articles = (await getCollection('blog')).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
  const updated = articles[0]?.data.date.toISOString() ?? '2024-11-02T00:00:00.000Z';
  const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="zh-CN">
  <title>Charming · 文字与记忆</title>
  <subtitle>Charming 的公开文章</subtitle>
  <id>${escapeXml(base.href)}</id>
  <link href="${escapeXml(new URL('/atom.xml', base).href)}" rel="self" type="application/atom+xml" />
  <link href="${escapeXml(base.href)}" rel="alternate" />
  <updated>${updated}</updated>
  <author><name>Charming</name></author>
  ${articles
    .map((article) => {
      const url = new URL(`/post/${article.id}/`, base).href;
      const date = article.data.date.toISOString();
      return `<entry>
    <title>${escapeXml(article.data.title)}</title>
    <id>${escapeXml(url)}</id>
    <link href="${escapeXml(url)}" rel="alternate" />
    <published>${date}</published>
    <updated>${date}</updated>
    <summary>${escapeXml(article.data.description)}</summary>
    <content type="text">${escapeXml(article.body ?? article.data.description)}</content>
    ${article.data.tags.map((tag) => `<category term="${escapeXml(tag)}" />`).join('\n    ')}
  </entry>`;
    })
    .join('\n  ')}
</feed>`;
  return new Response(feed, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
};
