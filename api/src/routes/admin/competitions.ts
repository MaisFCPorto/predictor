import { Hono } from 'hono';
import type { Env } from '../admin';
import { requireAdminKey } from '../admin';

export const adminCompetitions = new Hono<{ Bindings: Env }>();

adminCompetitions.use('*', requireAdminKey);

const DEFAULT_ACCENT = '#1559E8';
const DEFAULT_PILL = '#2878FF';
const HEX_COLOR = /^#[0-9A-F]{6}$/;

function normalizeColor(value: unknown, fallback: string): string | null {
  if (value == null || String(value).trim() === '') return fallback;
  const normalized = String(value).trim().toUpperCase();
  return HEX_COLOR.test(normalized) ? normalized : null;
}

function normalizeCode(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 20);
}

function normalizeWatermarkUrl(value: unknown): string | null | undefined {
  if (value == null || String(value).trim() === '') return null;

  const url = String(value).trim();
  if (url.length > 2048) return undefined;
  if (url.startsWith('/')) return url;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

adminCompetitions.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `
    SELECT id, code, name, accent_color, pill_color, watermark_url
    FROM competitions
    ORDER BY name COLLATE NOCASE
    `,
  ).all<{
    id: string;
    code: string;
    name: string;
    accent_color: string;
    pill_color: string;
    watermark_url: string | null;
  }>();

  return c.json(results ?? []);
});

adminCompetitions.post('/', async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | {
        id?: unknown;
        code?: unknown;
        name?: unknown;
        accent_color?: unknown;
        pill_color?: unknown;
        watermark_url?: unknown;
      }
    | null;

  if (!body) return c.json({ error: 'invalid_json' }, 400);

  const id = normalizeCode(body.id);
  const code = normalizeCode(body.code || body.id);
  const name = String(body.name ?? '').trim();
  const accentColor = normalizeColor(body.accent_color, DEFAULT_ACCENT);
  const pillColor = normalizeColor(body.pill_color, DEFAULT_PILL);
  const watermarkUrl = normalizeWatermarkUrl(body.watermark_url);

  if (!id || !code || !name) {
    return c.json({ error: 'missing_id_code_or_name' }, 400);
  }
  if (!accentColor || !pillColor) {
    return c.json(
      { error: 'invalid_color', detail: 'Usa cores HEX no formato #RRGGBB.' },
      400,
    );
  }
  if (watermarkUrl === undefined) {
    return c.json(
      {
        error: 'invalid_watermark_url',
        detail: 'Usa um URL http(s) ou um caminho iniciado por /.',
      },
      400,
    );
  }

  try {
    await c.env.DB.prepare(
      `
      INSERT INTO competitions (
        id, code, name, accent_color, pill_color, watermark_url
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(id, code, name, accentColor, pillColor, watermarkUrl)
      .run();

    return c.json({ ok: true, id }, 201);
  } catch (error) {
    return c.json(
      {
        error: 'create_failed',
        detail: String((error as Error)?.message ?? error),
      },
      409,
    );
  }
});

adminCompetitions.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as
    | {
        code?: unknown;
        name?: unknown;
        accent_color?: unknown;
        pill_color?: unknown;
        watermark_url?: unknown;
      }
    | null;

  if (!id) return c.json({ error: 'missing_id' }, 400);
  if (!body) return c.json({ error: 'invalid_json' }, 400);

  const current = await c.env.DB.prepare(
    `
    SELECT id, code, name, accent_color, pill_color, watermark_url
    FROM competitions
    WHERE id = ?
    LIMIT 1
    `,
  )
    .bind(id)
    .first<{
      id: string;
      code: string;
      name: string;
      accent_color: string;
      pill_color: string;
      watermark_url: string | null;
    }>();

  if (!current) return c.json({ error: 'competition_not_found' }, 404);

  const code = body.code === undefined ? current.code : normalizeCode(body.code);
  const name = body.name === undefined ? current.name : String(body.name).trim();
  const accentColor =
    body.accent_color === undefined
      ? current.accent_color
      : normalizeColor(body.accent_color, current.accent_color);
  const pillColor =
    body.pill_color === undefined
      ? current.pill_color
      : normalizeColor(body.pill_color, current.pill_color);
  const watermarkUrl =
    body.watermark_url === undefined
      ? current.watermark_url
      : normalizeWatermarkUrl(body.watermark_url);

  if (!code || !name) return c.json({ error: 'missing_code_or_name' }, 400);
  if (!accentColor || !pillColor) {
    return c.json(
      { error: 'invalid_color', detail: 'Usa cores HEX no formato #RRGGBB.' },
      400,
    );
  }
  if (watermarkUrl === undefined) {
    return c.json(
      {
        error: 'invalid_watermark_url',
        detail: 'Usa um URL http(s) ou um caminho iniciado por /.',
      },
      400,
    );
  }

  try {
    await c.env.DB.prepare(
      `
      UPDATE competitions
      SET code = ?, name = ?, accent_color = ?, pill_color = ?, watermark_url = ?
      WHERE id = ?
      `,
    )
      .bind(code, name, accentColor, pillColor, watermarkUrl, id)
      .run();

    return c.json({ ok: true });
  } catch (error) {
    return c.json(
      {
        error: 'update_failed',
        detail: String((error as Error)?.message ?? error),
      },
      409,
    );
  }
});
