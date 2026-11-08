import { SaxesParser } from 'saxes';

export const HUB_NEWS_CRON = '0 */3 * * *';

const feeds = [
  { source: 'RTP Notícias', url: 'https://www.rtp.pt/noticias/rss/desporto' },
  { source: 'A BOLA', url: 'https://www.abola.pt/rss-articles.xml' },
  { source: 'Record', url: 'https://www.record.pt/rss/' },
];

type Feed = (typeof feeds)[number];
type Item = Partial<Record<'title' | 'link' | 'pubDate', string>>;
type Article = { title: string; url: string; source: string; publishedAt: string };

const portoHeadline = /\b(?:f\.?\s*c\.?\s*porto|futebol clube do porto|dragão|dragões|portistas?)\b/i;
const dayMs = 24 * 60 * 60_000;

function readRss(xml: string): Item[] {
  const items: Item[] = [];
  const parser = new SaxesParser();
  let depth = 0;
  let item: Item | undefined;
  let field: keyof Item | undefined;

  parser.on('doctype', () => { throw new Error('Unexpected RSS doctype'); });
  parser.on('opentag', ({ name }) => {
    depth += 1;
    if (depth === 1 && name !== 'rss') throw new Error('Unexpected RSS root');
    if (depth === 3 && name === 'item') item = {};
    if (item && depth === 4 && (name === 'title' || name === 'link' || name === 'pubDate')) {
      field = name;
    }
  });

  const appendText = (text: string) => {
    if (item && field) item[field] = (item[field] ?? '') + text;
  };
  parser.on('text', appendText);
  parser.on('cdata', appendText);
  parser.on('closetag', ({ name }) => {
    if (depth === 4) field = undefined;
    if (depth === 3 && name === 'item' && item) {
      items.push(item);
      item = undefined;
    }
    depth -= 1;
  });

  parser.write(xml).close();
  return items;
}

function cleanText(value = '') {
  return value.trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').replace(/\s+/g, ' ').trim();
}

function articleFromItem(item: Item, feed: Feed, now: number): Article | null {
  const title = cleanText(item.title).slice(0, 400);
  const link = cleanText(item.link);
  const published = Date.parse(cleanText(item.pubDate));
  if (!title || !link || !Number.isFinite(published)) return null;
  if (published < now - 7 * dayMs || published > now + 60 * 60_000) return null;

  const sourceUrl = new URL(feed.url);
  let url: URL;
  try {
    url = new URL(link, sourceUrl);
  } catch {
    return null;
  }
  if (url.origin !== sourceUrl.origin || url.username || url.password) return null;
  if (!portoHeadline.test(title) && !url.pathname.split('/').includes('fc-porto')) return null;

  url.hash = '';
  for (const parameter of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(parameter)) url.searchParams.delete(parameter);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';

  return { title, url: url.href, source: feed.source, publishedAt: new Date(published).toISOString() };
}

async function readFeed(feed: Feed, now: number) {
  const response = await fetch(feed.url, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    redirect: 'manual',
    signal: AbortSignal.timeout(7_000),
  });
  if (!response.ok) throw new Error(`RSS HTTP ${response.status}`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 1_000_000) throw new Error('RSS response too large');
  const declaration = new TextDecoder().decode(bytes.subarray(0, 256));
  const encoding = declaration.match(/^\s*<\?xml[^>]*\bencoding\s*=\s*["']([^"']+)["']/i)?.[1]
    ?? response.headers.get('content-type')?.match(/\bcharset\s*=\s*["']?([\w-]+)/i)?.[1]
    ?? 'utf-8';

  let xml = '';
  if (/^(?:iso-8859-1|latin-?1)$/i.test(encoding)) {
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      xml += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
  } else {
    xml = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  }
  return readRss(xml)
    .map((item) => articleFromItem(item, feed, now))
    .filter((article): article is Article => article !== null);
}

export async function syncHubNews(db: D1Database, now = Date.now()) {
  const responses = await Promise.allSettled(feeds.map((feed) => readFeed(feed, now)));
  const articles = new Map<string, Article>();
  const failedSources: string[] = [];

  responses.forEach((result, index) => {
    if (result.status === 'rejected') {
      failedSources.push(feeds[index].source);
      console.warn('Hub RSS feed failed', feeds[index].source, result.reason);
      return;
    }
    for (const article of result.value) articles.set(article.url, article);
  });

  if (failedSources.length === feeds.length) throw new Error('All hub RSS feeds failed');

  const candidates = [...articles.values()]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 200);
  const statements: D1PreparedStatement[] = [];
  for (let offset = 0; offset < candidates.length; offset += 20) {
    const batch = candidates.slice(offset, offset + 20);
    const values = batch.map(() => '(?, ?, ?, ?)').join(', ');
    statements.push(db.prepare(`
      INSERT INTO hub_news (title, url, source, published_at)
      VALUES ${values}
      ON CONFLICT(url) DO NOTHING
    `).bind(...batch.flatMap(({ title, url, source, publishedAt }) => [title, url, source, publishedAt])));
  }

  const results = statements.length ? await db.batch(statements) : [];
  return {
    found: candidates.length,
    added: results.reduce((total, result) => total + (result.meta.changes ?? 0), 0),
    failedSources,
  };
}
