import { Hono } from 'hono';
import { manualHubArticle, storeHubNews, syncHubNews, type HubNewsArticle } from '../hub-news';
import { cleanNewsContext, enoughNewsContext, runNewsSummaries, summarySettings, validSummaryCopy, type NewsSummaryEnv } from '../hub-news-summaries';
import { newsOrder } from '../news-priority';

type Env = NewsSummaryEnv & { HUB_NEWS_KEY?: string };
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
    SELECT n.id AS articleId, CASE WHEN s.state = 'approved' THEN s.headline ELSE n.title END AS title,
           url, source, published_at AS publishedAt,
           CASE WHEN image_approved = 1 THEN image_url END AS imageUrl,
           CASE WHEN s.state = 'approved' THEN n.id END AS summaryId
    FROM hub_news n LEFT JOIN hub_news_summaries s ON s.news_id = n.id
    WHERE status = 'approved'
    ORDER BY ${newsOrder}
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
    SELECT n.id, title, url, source, published_at AS publishedAt, status, revision,
           image_url AS imageUrl, image_approved AS imageApproved, source_excerpt AS sourceExcerpt,
           s.state AS summaryState, s.headline AS summaryTitle, s.body AS summaryText,
           s.last_error AS summaryError, s.generated_at AS summaryGeneratedAt
    FROM hub_news n LEFT JOIN hub_news_summaries s ON s.news_id = n.id
    WHERE status = ?
    ORDER BY ${newsOrder}
    LIMIT ? OFFSET ?
  `).bind(status, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE).all<NewsItem>();
  return c.json({ items: results.slice(0, PAGE_SIZE), hasMore: results.length > PAGE_SIZE });
});

hubNews.get('/summary-settings', async (c) => c.json(await summarySettings(c.env)));

hubNews.get('/article/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id < 1) return c.json({ error: 'missing_article' }, 404);
  const article = await c.env.DB.prepare(`
    SELECT n.id, CASE WHEN s.state = 'approved' THEN s.headline ELSE n.title END AS title,
           CASE WHEN s.state = 'approved' THEN s.body END AS summary,
           n.title AS originalTitle, n.url AS sourceUrl, n.source, n.published_at AS publishedAt,
           CASE WHEN s.state = 'approved' THEN s.generated_at END AS generatedAt,
           CASE WHEN n.image_approved = 1 THEN n.image_url END AS imageUrl
    FROM hub_news n LEFT JOIN hub_news_summaries s ON s.news_id = n.id
    WHERE n.id = ? AND n.status = 'approved'
  `).bind(id).first();
  return article ? c.json(article) : c.json({ error: 'missing_article' }, 404);
});

hubNews.patch('/context', async (c) => {
  const change = await c.req.json<{ id?: number; revision?: number; context?: string }>().catch(() => null);
  if (!change || !Number.isSafeInteger(change.id) || (change.id ?? 0) < 1 ||
      !Number.isSafeInteger(change.revision) || (change.revision ?? -1) < 0 ||
      typeof change.context !== 'string' || change.context.length > 6000) return c.json({ error: 'invalid_context' }, 400);
  const context = cleanNewsContext(change.context);
  const token = crypto.randomUUID();
  const results = await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO hub_news_summaries (news_id, input_hash, state, edit_token)
      SELECT id, '', ?, ? FROM hub_news WHERE id = ? AND revision = ?
      ON CONFLICT(news_id) DO UPDATE SET input_hash = '', state = excluded.state, edit_token = excluded.edit_token,
        headline = NULL, body = NULL, response_json = NULL, generated_at = NULL, approved_at = NULL,
        model = NULL, attempts = 0, lease_token = NULL, lease_until = 0, last_error = NULL`)
      .bind(enoughNewsContext(context) ? 'queued' : 'insufficient', token, change.id, change.revision),
    c.env.DB.prepare(`UPDATE hub_news SET source_excerpt = ?, revision = revision + 1
      WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM hub_news_summaries WHERE news_id = ? AND edit_token = ?)`)
      .bind(context || null, change.id, change.revision, change.id, token),
  ]);
  return results[1].meta.changes === 1 ? c.json({ ok: true }) : c.json({ error: 'outdated_article' }, 409);
});

hubNews.patch('/summary', async (c) => {
  const change = await c.req.json<{ id?: number; revision?: number; title?: string; text?: string; decision?: string }>().catch(() => null);
  if (!change || !Number.isSafeInteger(change.id) || (change.id ?? 0) < 1 ||
      !Number.isSafeInteger(change.revision) || (change.revision ?? -1) < 0 ||
      !['draft', 'approved', 'rejected'].includes(change.decision ?? '') ||
      (change.decision !== 'rejected' && !validSummaryCopy(change.title, change.text))) return c.json({ error: 'invalid_summary' }, 400);
  const token = crypto.randomUUID();
  const results = await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE hub_news_summaries SET state = ?, headline = COALESCE(?, headline), body = COALESCE(?, body),
      approved_at = ?, last_error = NULL, edit_token = ?, lease_token = NULL, lease_until = 0
      WHERE news_id = ? AND state IN ('draft', 'approved', 'rejected', 'failed', 'insufficient') AND input_hash <> ''
        AND EXISTS (SELECT 1 FROM hub_news WHERE id = ? AND revision = ?)`)
      .bind(change.decision, change.decision === 'rejected' ? null : change.title!.trim(),
        change.decision === 'rejected' ? null : change.text!.trim(),
        change.decision === 'approved' ? new Date().toISOString() : null, token, change.id, change.id, change.revision),
    c.env.DB.prepare(`UPDATE hub_news SET revision = revision + 1,
      status = CASE WHEN ? = 'approved' THEN 'approved' ELSE status END,
      image_approved = CASE WHEN ? = 'approved' AND image_url IS NOT NULL THEN 1 ELSE image_approved END
      WHERE id = ? AND revision = ? AND EXISTS (SELECT 1 FROM hub_news_summaries WHERE news_id = ? AND edit_token = ?)`)
      .bind(change.decision, change.decision, change.id, change.revision, change.id, token),
  ]);
  return results[1].meta.changes === 1 ? c.json({ ok: true }) : c.json({ error: 'outdated_article' }, 409);
});

hubNews.post('/summaries', async (c) => {
  if (c.env.HUB_NEWS_SUMMARIES_ENABLED !== 'true' || !c.env.OPENAI_API_KEY?.trim()) {
    return c.json({ generated: 0, reason: c.env.HUB_NEWS_SUMMARIES_ENABLED === 'true' ? 'missing_key' : 'disabled' }, 503);
  }
  const body = await c.req.json<{ id?: number }>().catch(() => ({} as { id?: number }));
  if (!body || typeof body !== 'object' || (body.id !== undefined && (!Number.isSafeInteger(body.id) || body.id < 1))) return c.json({ error: 'invalid_article' }, 400);
  if (body.id !== undefined) {
    const input = await c.env.DB.prepare(`SELECT n.title, n.source_excerpt AS context, s.state, s.attempts
      FROM hub_news n LEFT JOIN hub_news_summaries s ON s.news_id = n.id WHERE n.id = ?`).bind(body.id)
      .first<{ title: string; context: string | null; state: string | null; attempts: number | null }>();
    if (!input) return c.json({ error: 'missing_article' }, 404);
    if (!enoughNewsContext(input.context ?? '', input.title)) return c.json({ generated: 0, reason: 'insufficient_context' });
    if (input.state === 'failed' && (input.attempts ?? 0) >= 3) return c.json({ generated: 0, reason: 'attempt_limit' });
    await c.env.DB.prepare(`UPDATE hub_news_summaries SET state = 'queued',
        response_json = CASE WHEN last_error = 'storage_failed' THEN response_json END, last_error = NULL
      WHERE news_id = ? AND state = 'failed' AND attempts < 3 AND lease_until <= ?`).bind(body.id, Date.now()).run();
  }
  const result = await runNewsSummaries(c.env, Date.now(), body.id, 1);
  return c.json(result, result.reason === 'disabled' || result.reason === 'missing_key' ? 503 : 200);
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
