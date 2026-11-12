import type { HubNewsArticle } from './hub-news';
import { cleanNewsContext, enoughNewsContext } from './hub-news-summaries';

const origin = 'https://maisfutebol.iol.pt';
const sectionUrl = origin + '/fc-porto';
const maxArticles = 4;
const maxBytes = 1_200_000;
type Candidate = { url: string; title: string; imageUrl: string | null };
type Stored = { url: string; sourceExcerpt: string | null; revision: number; contextKind: string };

function publicUrl(value: unknown, article = true, publisherOrigin = origin) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value, publisherOrigin);
    if (url.origin !== publisherOrigin || url.username || url.password || url.port ||
        (article && (url.pathname.split('/').filter(Boolean).length < (publisherOrigin === 'https://www.abola.pt' ? 2 : 3) || /\.(?:xml|json|js|css|pdf|png|jpe?g|mp4)$/i.test(url.pathname)))) return null;
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    for (const parameter of [...url.searchParams.keys()]) {
      if (/^(utm_|_gl$|fbclid$|gclid$)/i.test(parameter)) url.searchParams.delete(parameter);
    }
    url.searchParams.sort();
    return url.href;
  } catch { return null; }
}

function imageUrl(value: unknown, hosts = ['img.iol.pt']) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && hosts.includes(url.hostname) && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}

// Fixed publisher only. No cookies, authentication, browser scripts or external redirects.
async function readHtml(input: string, publisherOrigin = origin) {
  let url = input;
  const signal = AbortSignal.timeout(4_000);
  for (let hop = 0; hop < 3; hop++) {
    const response = await fetch(url, { redirect: 'manual', signal,
      headers: { Accept: 'text/html', 'User-Agent': 'PredictorPorto-News/1.0' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('Location');
      const next = location ? publicUrl(new URL(location, url).href, false, publisherOrigin) : null;
      await response.body?.cancel();
      if (!next || hop === 2) throw new Error('unavailable');
      url = next;
      continue;
    }
    if (!response.ok || !response.headers.get('Content-Type')?.includes('text/html')) {
      await response.body?.cancel();
      throw new Error('unavailable');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('unavailable');
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxBytes) throw new Error('too_large');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { html: new TextDecoder('utf-8', { fatal: true }).decode(bytes), url };
  }
  throw new Error('unavailable');
}

async function listing(html: string) {
  const items: Candidate[] = [];
  let current: Candidate | null = null;
  const parser = new HTMLRewriter()
    .on('.newsList .itemListaNoticias, .newsList .fistTitle', { element(element) {
      const candidate: Candidate = { url: '', title: '', imageUrl: null };
      current = candidate;
      element.onEndTag(() => {
        if (candidate.url && candidate.title.trim()) items.push({ ...candidate, title: cleanNewsContext(candidate.title).slice(0, 400) });
        current = null;
      });
    } })
    .on('.newsList .itemListaNoticias .newsTitle h2 a[href]', {
      element(element) { if (current) current.url = publicUrl(element.getAttribute('href')) ?? ''; },
      text(chunk) { if (current && current.title.length < 1000) current.title += chunk.text; },
    })
    .on('.newsList .fistTitle > a[href]', { element(element) {
      if (current) current.url = publicUrl(element.getAttribute('href')) ?? '';
    } })
    .on('.newsList .fistTitle h1', { text(chunk) {
      if (current && current.title.length < 1000) current.title += chunk.text;
    } })
    .on('.newsList .fistTitle [data-src]', { element(element) {
      if (current) current.imageUrl ??= imageUrl(element.getAttribute('data-src'));
    } })
    .on('.newsList .itemListaNoticias img', { element(element) {
      if (current) current.imageUrl ??= imageUrl(element.getAttribute('data-src') ?? element.getAttribute('src'));
    } });
  await parser.transform(new Response(html)).text();
  return [...new Map(items.map((item) => [item.url, item])).values()].slice(0, 12);
}

export async function readPublicNewsArticle(input: string, source: 'Maisfutebol' | 'Record' | 'A BOLA', now: number): Promise<HubNewsArticle | null> {
  const publisherOrigin = source === 'Record' ? 'https://www.record.pt' : source === 'A BOLA' ? 'https://www.abola.pt' : origin;
  const canonical = publicUrl(input, true, publisherOrigin);
  if (!canonical) return null;
  const { html, url } = await readHtml(canonical, publisherOrigin);
  const scripts: string[] = [];
  const paragraphs: { text: string }[] = [];
  let script: { text: string } | null = null, paragraph: { text: string } | null = null;
  let blocked = 0, articleDepth = 0;
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const parser = new HTMLRewriter()
    .on('*', { element(element) {
      if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml') return;
      if (voidTags.has(element.tagName)) { if (element.tagName === 'br' && paragraph) paragraph.text += ' '; return; }
      const classes = (element.getAttribute('class') ?? '').split(/\s+/);
      const body = source === 'Record' ? classes.includes('news-content') : source === 'A BOLA'
        ? element.getAttribute('id') === 'article_body' : classes.includes('articleBody');
      if (body) articleDepth++;
      const hidden = element.getAttribute('hidden') !== null || element.getAttribute('aria-hidden') === 'true' ||
        /display\s*:\s*none|visibility\s*:\s*hidden/i.test(element.getAttribute('style') ?? '') ||
        ['script', 'style'].includes(element.tagName) || classes.some((name) =>
          ['pub-outer-wrapper', 'iol-comercial-placement', 'mcd-hidden-block', 'premium-cta-format'].includes(name));
      if (hidden) blocked++;
      const data = element.tagName === 'script' && element.getAttribute('type') === 'application/ld+json' ? { text: '' } : null;
      if (data) script = data;
      const copy = ['p', 'h2', 'h3', 'li', 'blockquote'].includes(element.tagName) && articleDepth > 0 && !blocked && !paragraph ? { text: '' } : null;
      if (copy) { paragraph = copy; paragraphs.push(copy); }
      if (!hidden && !body && !data && !copy) return;
      // One end handler per element: HTMLRewriter replaces a previously registered handler.
      element.onEndTag(() => {
        if (hidden) blocked--;
        if (body) articleDepth--;
        if (data && scripts.length < 8 && data.text.length <= 100_000) scripts.push(data.text);
        if (data && script === data) script = null;
        if (copy && paragraph === copy) paragraph = null;
      });
    } })
    .on('script[type="application/ld+json"]', {
      text(chunk) { if (script && script.text.length <= 100_000) script.text += chunk.text; },
    })
    .onDocument({
      text(chunk) { if (articleDepth > 0 && !blocked && paragraph && paragraph.text.length < 12_000) paragraph.text += chunk.text; },
    });
  await parser.transform(new Response(html)).text();
  const objects: any[] = [];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script);
      objects.push(...(Array.isArray(parsed) ? parsed : [parsed]));
      if (Array.isArray(parsed?.['@graph'])) objects.push(...parsed['@graph']);
    } catch { /* An invalid metadata block is never source text. */ }
  }
  const metadata = objects.find((item) => item && (Array.isArray(item['@type']) ? item['@type'].includes('NewsArticle') : item['@type'] === 'NewsArticle') &&
    publicUrl(typeof item.mainEntityOfPage === 'string' ? item.mainEntityOfPage : item.mainEntityOfPage?.['@id'] ?? item.url, true, publisherOrigin) === url);
  if (!metadata || metadata.isAccessibleForFree === false || String(metadata.isAccessibleForFree).toLowerCase() === 'false') return null;
  const title = cleanNewsContext(metadata.headline);
  const published = Date.parse(metadata.datePublished);
  if (!title || title.length > 400 || !Number.isFinite(published) || published < now - 7 * 86_400_000 || published > now + 3_600_000) return null;
  const image = Array.isArray(metadata.image) ? metadata.image[0] : metadata.image;
  return { title, url, source, publishedAt: new Date(published).toISOString(),
    imageUrl: imageUrl(typeof image === 'string' ? image : image?.url, source === 'Record' ? ['cdn.record.pt'] : source === 'A BOLA' ? ['sportal365images.com', 'www.abola.pt'] : ['img.iol.pt']),
    sourceExcerpt: cleanNewsContext(paragraphs.map((item) => item.text).join(' ')) || null,
    contextKind: 'article' };
}

export async function collectMaisfutebolArticles(db: D1Database, articles: Map<string, HubNewsArticle>, now: number) {
  let categoryRead = false;
  let candidates: Candidate[] = [];
  try {
    const page = await readHtml(sectionUrl);
    candidates = await listing(page.html);
    categoryRead = candidates.length > 0;
  } catch { /* The direct RSS remains usable when the section is unavailable. */ }
  return { categoryRead, ...await collectLinkedArticles(db, articles, now, 'Maisfutebol', candidates) };
}

export async function collectLinkedArticles(db: D1Database, articles: Map<string, HubNewsArticle>, now: number,
  source: 'Maisfutebol' | 'Record' | 'A BOLA', candidates: Candidate[] = []) {
  const publisherOrigin = source === 'Record' ? 'https://www.record.pt' : source === 'A BOLA' ? 'https://www.abola.pt' : origin;
  const rssItems = [...articles.values()].filter((item) => item.source === source);
  candidates.push(...rssItems);
  candidates = [...new Map(candidates.map((item) => [item.url, item])).values()].filter((item) => publicUrl(item.url, true, publisherOrigin));
  if (!candidates.length) return { articlesRead: 0 };
  const { results } = await db.prepare(`SELECT url, source_excerpt AS sourceExcerpt, revision, context_kind AS contextKind FROM hub_news
    WHERE url IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(candidates.map((item) => item.url))).all<Stored>();
  const known = new Map(results.map((item) => [item.url, item]));
  let cache: Cache | null = null;
  try { cache = await caches.open('predictor-public-news-backoff-v1'); } catch { /* Cache availability does not gate collection. */ }
  const due: Candidate[] = [];
  for (const item of candidates) {
    const stored = known.get(item.url);
    const incoming = articles.get(item.url);
    if (stored?.contextKind === 'manual' || (stored?.contextKind !== 'feed' && enoughNewsContext(stored?.sourceExcerpt ?? '', incoming?.title ?? item.title))) continue;
    if (!stored && incoming?.contextKind === 'article') continue;
    if (stored && (stored.sourceExcerpt ?? '') !== (incoming?.sourceExcerpt ?? '')) continue;
    try {
      const response = await cache?.match(item.url);
      const retryAt = response ? await response.json<{ retryAt?: number }>() : null;
      if (typeof retryAt?.retryAt === 'number' && retryAt.retryAt > now) continue;
    } catch { /* A cache miss or failure permits a bounded public read. */ }
    due.push(item);
    if (due.length === maxArticles) break;
  }
  const defer = async (url: string) => {
    try { await cache?.put(url, Response.json({ retryAt: now + 6 * 3_600_000 }, { headers: { 'Cache-Control': 'public, max-age=21600' } })); }
    catch { /* Only a retry timestamp is cached, never an article body. */ }
  };
  let articlesRead = 0;
  // Two connections at a time; four article reads at most in each news run.
  for (let offset = 0; offset < due.length; offset += 2) {
    const responses = await Promise.allSettled(due.slice(offset, offset + 2).map((item) => readPublicNewsArticle(item.url, source, now)));
    for (let index = 0; index < responses.length; index++) {
      const response = responses[index];
      const candidate = due[offset + index];
      if (response.status !== 'fulfilled' || !response.value) { await defer(candidate.url); continue; }
      const value = response.value;
      if (value.url !== candidate.url) { await defer(candidate.url); continue; }
      if (!enoughNewsContext(value.sourceExcerpt ?? '', value.title)) await defer(candidate.url);
      value.imageUrl ??= candidate.imageUrl;
      const stored = known.get(candidate.url);
      if (stored && enoughNewsContext(value.sourceExcerpt ?? '', value.title)) {
        await db.prepare(`UPDATE hub_news SET source_excerpt = ?, context_kind = 'article', revision = revision + 1
          WHERE url = ? AND revision = ? AND COALESCE(source_excerpt, '') = ?`)
          .bind(value.sourceExcerpt, stored.url, stored.revision, stored.sourceExcerpt ?? '').run();
      }
      articles.set(value.url, value);
      articlesRead++;
    }
  }
  return { articlesRead };
}
