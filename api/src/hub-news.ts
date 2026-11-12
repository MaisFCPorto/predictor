import { SaxesParser } from 'saxes';
import { cleanNewsContext } from './hub-news-summaries';
import { collectMaisfutebolArticles, collectLinkedArticles } from './news-article-reader';
import { pruneUnapprovedNews, withinNewsRetention } from './news-retention';
import { portoHeadline } from './news-relevance';

export const HUB_NEWS_CRON = '0 */3 * * *';
export type NewsFeedEnv = { HUB_NEWS_KEY?: string; HUB_NEWS_FEED_ORIGIN?: string };

type Feed = { source: string; url: string; imageHosts: readonly string[]; publisherHost?: string };
type Item = Partial<Record<'title' | 'link' | 'pubDate' | 'description' | 'image' | 'publisher', string>>;
export type HubNewsArticle = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl: string | null;
  sourceExcerpt?: string | null;
  contextKind?: 'legacy' | 'feed' | 'article' | 'manual';
};

const bolaFeed: Feed = {
  source: 'A BOLA',
  url: 'https://www.abola.pt/rss-articles.xml',
  imageHosts: ['sportal365images.com', 'www.abola.pt'],
};
const feeds: Feed[] = [
  // O Jogo provides public headlines. Its full articles are not accessible here.
  { source: 'O Jogo', publisherHost: 'www.ojogo.pt', imageHosts: [],
    url: 'https://news.google.com/rss/search?q=%22FC%20Porto%22%20site%3Aojogo.pt%20when%3A2d&hl=pt-PT&gl=PT&ceid=PT%3Apt-150' },
  { source: 'RTP Notícias', url: 'https://www.rtp.pt/noticias/rss/desporto', imageHosts: ['cdn-images.rtp.pt'] },
  bolaFeed,
  { source: 'Record', url: 'https://www.record.pt/rss/', imageHosts: ['cdn.record.pt'] },
  { source: 'Maisfutebol', url: 'https://maisfutebol.iol.pt/rss.xml', imageHosts: ['img.iol.pt'] },
  { source: 'zerozero', url: 'https://www.zerozero.pt/rss/noticias.php', imageHosts: ['www.zerozero.pt'] },
];
const publishers = [
  ...feeds.map(({ source, url, publisherHost }) => ({ source, hostname: publisherHost ?? new URL(url).hostname })),
  { source: 'FC Porto', hostname: 'www.fcporto.pt' },
  { source: 'O Jogo', hostname: 'www.ojogo.pt' },
];

function readRss(xml: string): Item[] {
  const items: Item[] = [];
  const parser = new SaxesParser();
  let depth = 0;
  let item: Item | undefined;
  let field: keyof Item | undefined;

  parser.on('doctype', () => { throw new Error('Unexpected RSS doctype'); });
  parser.on('opentag', ({ name, attributes }) => {
    depth += 1;
    if (depth === 1 && name !== 'rss') throw new Error('Unexpected RSS root');
    if (depth === 3 && name === 'item') item = {};
    if (item && depth === 4 && (name === 'title' || name === 'link' || name === 'pubDate' || name === 'description')) {
      field = name;
    }
    if (item && depth === 4 && name === 'source') item.publisher = attributes.url;
    if (item && (depth === 4 || depth === 5)) {
      const isImage = attributes.type?.startsWith('image/') || attributes.medium === 'image';
      if (name === 'media:thumbnail' || (isImage && (name === 'media:content' || name === 'enclosure'))) {
        item.image ??= attributes.url;
      }
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

function parseHttpsUrl(value: unknown, base?: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) return null;
  try {
    const url = new URL(value.replace(/&amp;/gi, '&').trim(), base);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return url;
  } catch {
    return null;
  }
}

function canonicalArticleUrl(url: URL) {
  url.hash = '';
  for (const parameter of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(parameter)) url.searchParams.delete(parameter);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
}

function imageFromFeed(value: unknown, feed: Feed) {
  const url = parseHttpsUrl(value, feed.url);
  return url && feed.imageHosts.includes(url.hostname) ? url.href : null;
}

export function manualHubArticle(input: unknown): HubNewsArticle | null {
  if (!input || typeof input !== 'object') return null;
  const { title, url: link, imageUrl: image, publishedAt, sourceExcerpt } = input as Partial<Record<keyof HubNewsArticle, unknown>>;
  if (typeof title !== 'string' || title.length > 400 || typeof publishedAt !== 'string') return null;
  if (sourceExcerpt !== undefined && sourceExcerpt !== null && (typeof sourceExcerpt !== 'string' || sourceExcerpt.length > 6000)) return null;

  const url = parseHttpsUrl(link);
  const cleanTitle = cleanText(title);
  const timestamp = Date.parse(publishedAt);
  if (!url || url.pathname === '/' || !cleanTitle || !Number.isFinite(timestamp) || timestamp > Date.now() + 60 * 60_000) {
    return null;
  }

  const publisher = publishers.find(({ hostname }) =>
    hostname.replace(/^www\./, '') === url.hostname.replace(/^www\./, ''));
  if (!publisher) return null;
  url.hostname = publisher.hostname;

  const imageUrl = image ? parseHttpsUrl(image) : null;
  if (image && (!imageUrl || !imageUrl.hostname.includes('.') || /^[\d.]+$/.test(imageUrl.hostname) ||
    /\.(?:localhost|local|internal)$/.test(imageUrl.hostname))) return null;

  return {
    title: cleanTitle,
    url: canonicalArticleUrl(url),
    source: publisher.source,
    publishedAt: new Date(timestamp).toISOString(),
    imageUrl: imageUrl?.href ?? null,
    sourceExcerpt: cleanNewsContext(sourceExcerpt) || null,
    contextKind: sourceExcerpt ? 'manual' : 'feed',
  };
}

function articleFromItem(item: Item, feed: Feed, now: number): HubNewsArticle | null {
  let title = cleanText(item.title).slice(0, 400);
  const link = cleanText(item.link);
  const published = Date.parse(cleanText(item.pubDate));
  if (!title || !link || !Number.isFinite(published)) return null;
  if (!withinNewsRetention(new Date(published).toISOString(), now) || published > now + 60 * 60_000) return null;

  const url = parseHttpsUrl(link, feed.url);
  if (!url || url.origin !== new URL(feed.url).origin) return null;
  if (feed.publisherHost) {
    const publisher = parseHttpsUrl(item.publisher);
    if (!publisher || publisher.hostname.replace(/^www\./, '') !== feed.publisherHost.replace(/^www\./, '') ||
        !/^\/rss\/articles\/[A-Za-z0-9_-]+$/.test(url.pathname)) return null;
    const suffix = ' - ' + feed.source;
    if (title.endsWith(suffix)) title = title.slice(0, -suffix.length);
    if (!portoHeadline(title)) return null;
  } else if (!portoHeadline(title) && !url.pathname.split('/').includes('fc-porto')) return null;

  const thumbnail = item.description?.match(/<img\b[^>]*?\s+src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  const imageUrl = imageFromFeed(item.image, feed) ??
    imageFromFeed(thumbnail?.[1] ?? thumbnail?.[2] ?? thumbnail?.[3], feed);
  return {
    title,
    url: canonicalArticleUrl(url),
    source: feed.source,
    publishedAt: new Date(published).toISOString(),
    imageUrl,
    sourceExcerpt: feed.publisherHost ? null : cleanNewsContext(item.description) || null,
    contextKind: 'feed',
  };
}

async function readFeed(feed: Feed, now: number, env?: NewsFeedEnv) {
  let target = feed.url;
  let response: Response | undefined;
  const signal = AbortSignal.timeout(7_000);
  try { for (let hop = 0; hop < 3; hop++) {
    response = await fetch(target, { headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'PredictorPorto-News/1.0' }, redirect: 'manual', signal });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('Location');
    const next = location ? parseHttpsUrl(location, target) : null;
    await response.body?.cancel();
    if (!next || next.origin !== new URL(feed.url).origin || hop === 2) throw new Error('RSS_REDIRECT_BLOCKED');
    target = next.href;
  }
  if (!response?.ok) throw new Error(`RSS_HTTP_${response?.status ?? 0}`);
  } catch (error) {
    // The site's server is a second client of the same public metadata feed.
    // This credential is sent only to our own fixed origin, never to Google or publishers.
    if (!feed.publisherHost || env?.HUB_NEWS_FEED_ORIGIN !== 'https://maispredictor.app' || !env.HUB_NEWS_KEY?.trim()) throw error;
    response = await fetch('https://maispredictor.app/api/internal/hub-news-feeds/ojogo', {
      headers: { 'x-hub-news-key': env.HUB_NEWS_KEY.trim(), Accept: 'application/rss+xml' }, redirect: 'manual', signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) throw new Error(`RSS_HTTP_${response.status}`);
    target = 'https://maispredictor.app/';
  }

  try { return await parseFeedResponse(response, feed, now); }
  catch (error) {
    if (!feed.publisherHost || env?.HUB_NEWS_FEED_ORIGIN !== 'https://maispredictor.app' || !env.HUB_NEWS_KEY?.trim() || target.startsWith('https://maispredictor.app/')) throw error;
    const fallback = await fetch('https://maispredictor.app/api/internal/hub-news-feeds/ojogo', {
      headers: { 'x-hub-news-key': env.HUB_NEWS_KEY.trim(), Accept: 'application/rss+xml' }, redirect: 'manual', signal: AbortSignal.timeout(7_000),
    });
    if (!fallback.ok) throw new Error(`RSS_HTTP_${fallback.status}`);
    return parseFeedResponse(fallback, feed, now);
  }
}

async function parseFeedResponse(response: Response, feed: Feed, now: number) {
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
    .filter((article): article is HubNewsArticle => article !== null);
}

async function readBolaPreview(url: string) {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/html' },
      redirect: 'manual',
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return null;

    let image: string | null = null;
    let headComplete = false;
    const reader = new HTMLRewriter()
      .on('head', { element: (element) => element.onEndTag(() => { headComplete = true; }) })
      .on('head meta[property="og:image"]', {
        element: (element) => { image ??= imageFromFeed(element.getAttribute('content'), bolaFeed); },
      })
      .transform(response).body?.getReader();
    if (!reader) return null;
    try {
      let bytes = 0;
      while (!image && !headComplete && bytes < 512_000) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
      }
      return image;
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  } catch {
    return null;
  }
}

async function addBolaPreviews(db: D1Database, articles: HubNewsArticle[]) {
  const candidates = articles.filter(({ source, imageUrl }) => source === bolaFeed.source && !imageUrl).slice(0, 50);
  if (!candidates.length) return;

  const placeholders = candidates.map(() => '?').join(', ');
  const { results } = await db.prepare(`
    SELECT url FROM hub_news WHERE image_url IS NOT NULL AND url IN (${placeholders})
  `).bind(...candidates.map(({ url }) => url)).all<{ url: string }>();
  const covered = new Set(results.map(({ url }) => url));
  await Promise.all(candidates.filter(({ url }) => !covered.has(url)).slice(0, 6).map(async (article) => {
    article.imageUrl = await readBolaPreview(article.url);
  }));
}

export async function storeHubNews(db: D1Database, articles: HubNewsArticle[]) {
  const statements: D1PreparedStatement[] = [];
  for (let offset = 0; offset < articles.length; offset += 16) {
    const batch = articles.slice(offset, offset + 16);
    statements.push(db.prepare(`UPDATE hub_news_sequence
      SET last_id = MAX(last_id, (SELECT COALESCE(MAX(id), 0) FROM hub_news)) + ? WHERE singleton = 1`).bind(batch.length));
    const values = batch.map((_, index) => `((SELECT last_id - ${batch.length - index - 1} FROM hub_news_sequence WHERE singleton = 1), ?, ?, ?, ?, ?, ?)`).join(', ');
    statements.push(db.prepare(`
      INSERT INTO hub_news (id, title, url, source, published_at, image_url, context_kind)
      VALUES ${values}
      ON CONFLICT(url) DO UPDATE SET image_url = excluded.image_url, revision = hub_news.revision + 1
      WHERE hub_news.image_url IS NULL AND excluded.image_url IS NOT NULL
      RETURNING revision
    `).bind(...batch.flatMap(({ title, url, source, publishedAt, imageUrl, contextKind }) => [title, url, source, publishedAt, imageUrl, contextKind ?? 'feed'])));
  }

  const results = statements.length ? await db.batch<{ revision: number }>(statements) : [];
  const excerpts = articles.filter((article) => article.sourceExcerpt);
  if (excerpts.length) await db.prepare(`
    WITH incoming AS (SELECT json_extract(value, '$.url') AS url, json_extract(value, '$.sourceExcerpt') AS excerpt FROM json_each(?))
    UPDATE hub_news SET source_excerpt = (SELECT excerpt FROM incoming WHERE incoming.url = hub_news.url LIMIT 1), revision = revision + 1
    WHERE TRIM(COALESCE(source_excerpt, '')) = '' AND EXISTS (SELECT 1 FROM incoming WHERE incoming.url = hub_news.url)
  `).bind(JSON.stringify(excerpts.map(({ url, sourceExcerpt }) => ({ url, sourceExcerpt })))).run();
  const changes = results.flatMap(({ results }) => results);
  const added = changes.filter(({ revision }) => revision === 0).length;
  return { added, imagesAdded: changes.length - added };
}

export async function syncHubNews(db: D1Database, now = Date.now(), env?: NewsFeedEnv) {
  // Run before contacting publishers so an outage cannot block retention.
  const removed = await pruneUnapprovedNews(db, now);
  const responses = await Promise.allSettled(feeds.map((feed) => readFeed(feed, now, env)));
  const articles = new Map<string, HubNewsArticle>();
  const failedSources: string[] = [];
  const failedSourceDetails: { source: string; code: string }[] = [];

  responses.forEach((result, index) => {
    if (result.status === 'rejected') {
      failedSources.push(feeds[index].source);
      const message = result.reason instanceof Error ? result.reason.message : '';
      failedSourceDetails.push({ source: feeds[index].source, code: /^RSS_(?:HTTP_\d{3}|REDIRECT_BLOCKED)$/.test(message) ? message : 'RSS_UNAVAILABLE' });
      console.warn('Hub RSS feed failed', feeds[index].source, result.reason);
      return;
    }
    for (const article of result.value) articles.set(article.url, article);
  });

  const [direct, record, bola] = await Promise.all([
    collectMaisfutebolArticles(db, articles, now),
    collectLinkedArticles(db, articles, now, 'Record'),
    collectLinkedArticles(db, articles, now, 'A BOLA'),
  ]);
  if (direct.categoryRead) {
    const index = failedSources.indexOf('Maisfutebol');
    if (index >= 0) failedSources.splice(index, 1);
  }
  if (failedSources.length === feeds.length) throw new Error('All hub RSS feeds failed');

  const candidates = [...articles.values()]
    .filter((article) => withinNewsRetention(article.publishedAt, now))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 200);
  await addBolaPreviews(db, candidates);
  return {
    removed,
    found: candidates.length,
    articlesRead: direct.articlesRead + record.articlesRead + bola.articlesRead,
    ...await storeHubNews(db, candidates),
    failedSources,
    failedSourceDetails: failedSourceDetails.filter((item) => failedSources.includes(item.source)),
  };
}
