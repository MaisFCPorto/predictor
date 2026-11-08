import { Hono } from 'hono';
import { manualHubArticle, storeHubNews, syncHubNews, type HubNewsArticle } from '../hub-news';

type Env = { DB: D1Database; HUB_NEWS_KEY?: string };
type Status = 'pending' | 'approved' | 'rejected';
type NewsItem = HubNewsArticle & { id: number; status: Status; revision: number; imageApproved: 0 | 1 };

const PAGE_SIZE = 25;
const isStatus = (value: unknown): value is Status =>
  value === 'pending' || value === 'approved' || value === 'rejected';

export const hubNews = new Hono<{ Bindings: Env }>();

hubNews.use('*', async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  const key = c.env.HUB_NEWS_KEY?.trim();
  if (!key || c.req.header('x-hub-news-key') !== key) return c.body(null, 404);
  await next();
});

hubNews.get('/published', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT title, url, source, published_at AS publishedAt,
           CASE WHEN image_approved = 1 THEN image_url END AS imageUrl
    FROM hub_news
    WHERE status = 'approved'
    ORDER BY published_at DESC, id DESC
    LIMIT 12
  `).all<HubNewsArticle>();
  return c.json(results);
});

hubNews.get('/', async (c) => {
  const status = c.req.query('status') ?? 'pending';
  const page = Number(c.req.query('page') ?? '1');
  if (!isStatus(status) || !Number.isInteger(page) || page < 1 || page > 10_000) {
    return c.json({ error: 'invalid_filter' }, 400);
  }

  const { results } = await c.env.DB.prepare(`
    SELECT id, title, url, source, published_at AS publishedAt, status, revision,
           image_url AS imageUrl, image_approved AS imageApproved
    FROM hub_news
    WHERE status = ?
    ORDER BY published_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).bind(status, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE).all<NewsItem>();
  return c.json({ items: results.slice(0, PAGE_SIZE), hasMore: results.length > PAGE_SIZE });
});

hubNews.post('/', async (c) => {
  const article = manualHubArticle(await c.req.json().catch(() => null));
  if (!article) return c.json({ error: 'invalid_article' }, 400);
  const result = await storeHubNews(c.env.DB, [article]);
  if (!result.added && !result.imagesAdded) return c.json({ error: 'duplicate_article' }, 409);
  return c.json(result, result.added ? 201 : 200);
});

hubNews.patch('/', async (c) => {
  const change = await c.req.json<Partial<NewsItem> | null>().catch(() => null);
  if (
    !change ||
    !Number.isSafeInteger(change.id) || (change.id ?? 0) < 1 ||
    !Number.isSafeInteger(change.revision) || (change.revision ?? -1) < 0 ||
    (change.status !== 'approved' && change.status !== 'rejected')
  ) {
    return c.json({ error: 'invalid_decision' }, 400);
  }

  const result = await c.env.DB.prepare(`
    UPDATE hub_news
    SET status = ?,
        image_approved = CASE WHEN ? = 'approved' AND image_url IS NOT NULL THEN 1 ELSE 0 END,
        revision = revision + 1
    WHERE id = ? AND revision = ?
      AND (status <> ? OR (? = 'approved' AND image_url IS NOT NULL AND image_approved = 0))
  `).bind(change.status, change.status, change.id, change.revision, change.status, change.status).run();
  if (result.meta.changes === 1) return c.json({ ok: true });

  const current = await c.env.DB.prepare(`
    SELECT status, image_url AS imageUrl, image_approved AS imageApproved FROM hub_news WHERE id = ?
  `)
    .bind(change.id)
    .first<Pick<NewsItem, 'status' | 'imageUrl' | 'imageApproved'>>();
  if (!current) return c.json({ error: 'missing_article' }, 404);
  const imagePending = current.status === 'approved' && current.imageUrl && !current.imageApproved;
  if (current.status === change.status && !imagePending) return c.json({ ok: true });
  return c.json({ error: 'outdated_article' }, 409);
});

hubNews.post('/sync', async (c) => {
  try {
    return c.json(await syncHubNews(c.env.DB));
  } catch (error) {
    console.error('Hub news sync failed', error);
    return c.json({ error: 'sync_failed' }, 502);
  }
});
