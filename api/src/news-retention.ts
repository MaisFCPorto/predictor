import { portoHeadline } from './news-relevance';

export const HUB_NEWS_RETENTION_MS = 48 * 60 * 60_000;

export function withinNewsRetention(publishedAt: string, now: number) {
  return Date.parse(publishedAt) >= now - HUB_NEWS_RETENTION_MS;
}

export async function pruneUnapprovedNews(db: D1Database, now: number) {
  const cutoff = new Date(now - HUB_NEWS_RETENTION_MS).toISOString();
  const candidates = await db.prepare(`SELECT id, revision, title FROM hub_news
    WHERE status IN ('pending', 'rejected') AND source = 'O Jogo'
      AND url LIKE 'https://news.google.com/rss/articles/%' AND context_kind = 'feed'`)
    .all<{ id: number; revision: number; title: string }>();
  const irrelevant = candidates.results.filter((item) => !portoHeadline(item.title)).map(({ id, revision }) => ({ id, revision }));
  const results = await db.batch<{ id: number }>([
    // Also account for any IDs inserted through earlier code or manual SQL.
    db.prepare('UPDATE hub_news_sequence SET last_id = MAX(last_id, (SELECT COALESCE(MAX(id), 0) FROM hub_news)) WHERE singleton = 1'),
    db.prepare(`
    DELETE FROM hub_news
    WHERE status IN ('pending', 'rejected')
      AND (julianday(published_at) < julianday(?) OR source = 'Jornal de Notícias' OR EXISTS (
        SELECT 1 FROM json_each(?) item
        WHERE json_extract(item.value, '$.id') = hub_news.id AND json_extract(item.value, '$.revision') = hub_news.revision
      ))
      AND NOT EXISTS (
        SELECT 1 FROM hub_news_summaries s WHERE s.news_id = hub_news.id AND s.lease_until > ?
      )
    RETURNING id
  `).bind(cutoff, JSON.stringify(irrelevant), now),
  ]);
  // Related drafts are removed by the existing foreign key; daily usage remains.
  return results[1].results.length;
}

