// predictor-porto/api/src/routes/admin.ts
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { scoreUEFA } from './rankings';

type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
  FOOTBALL_DATA_TOKEN: string;
};

// 🔥 Exportar para usar noutros ficheiros (index.ts)
export async function recomputePointsForFixture(DB: D1Database, fixtureId: string) {
  // 1) Obter o resultado oficial do jogo
  const fx = await DB.prepare(
    `
      SELECT id, home_score, away_score
      FROM fixtures
      WHERE id = ?
      LIMIT 1
    `,
  )
    .bind(fixtureId)
    .first<{ id: string; home_score: number | null; away_score: number | null }>();

  // Se ainda não houver resultado, não há nada para fazer
  if (!fx || fx.home_score == null || fx.away_score == null) {
    return;
  }

  // 2) Ir buscar as predictions desse jogo
  const { results } = await DB.prepare(
    `
      SELECT
        user_id,
        fixture_id,
        home_goals,
        away_goals
      FROM predictions
      WHERE fixture_id = ?
    `,
  )
    .bind(fixtureId)
    .all<{
      user_id: string;
      fixture_id: string;
      home_goals: number | null;
      away_goals: number | null;
    }>();

  // 3) Calcular pontos UEFA + gravar no campo "points"
  for (const p of results ?? []) {
    const s = scoreUEFA(p.home_goals, p.away_goals, fx.home_score, fx.away_score);

    // uso user_id + fixture_id para identificar a row (não assumo que tens coluna id)
    await DB.prepare(
      `
        UPDATE predictions
        SET points = ?
        WHERE user_id = ?
          AND fixture_id = ?
      `,
    )
      .bind(s.points, p.user_id, p.fixture_id)
      .run();
  }
}

// Middleware: exige header x-admin-key (chave guardada no Worker)
const requireAdminKey: import('hono').MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const key = c.req.header('x-admin-key');
  if (!key || key !== c.env.ADMIN_KEY) return c.json({ error: 'forbidden' }, 403);
  await next();
};

// Exporta um router Hono (não a app global)
export const admin = new Hono<{ Bindings: Env }>();

admin.get('/health', (c) => c.json({ ok: true }));

admin.get('/role', requireAdminKey, async (c) => {
  const email = c.req.query('email');
  if (!email) return c.json({ error: 'email required' }, 400);

  const row = await c.env.DB
    .prepare('SELECT role FROM users WHERE email = ?')
    .bind(email)
    .first<{ role: string }>();

  return c.json({ role: row?.role ?? 'user' });
});

// --- NOVO: lista de equipas
admin.get('/teams', requireAdminKey, async (c) => {
  const { results } = await c.env.DB
    .prepare(`SELECT id, name FROM teams ORDER BY name`)
    .all();
  return c.json(results);
});

// --- NOVO: lista de competições
admin.get('/competitions', requireAdminKey, async (c) => {
  const { results } = await c.env.DB
    .prepare(`SELECT id, code, name FROM competitions ORDER BY name`)
    .all();
  return c.json(results);
});

admin.get('/fixtures/porto', requireAdminKey, async (c) => {
  const token = (c.env.FOOTBALL_DATA_TOKEN || '').trim();
  if (!token) return c.json({ error: 'missing token' }, 500);

  const url = 'https://api.football-data.org/v4/teams/503/matches?status=SCHEDULED';
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Auth-Token': token,
      accept: 'application/json',
    },
    redirect: 'manual',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    const status =
      res.status === 204 || res.status === 205 || res.status === 304 ? 500 : res.status;
    return c.json(
      { error: 'upstream', status: res.status, body },
      status as ContentfulStatusCode,
    );
  }

  const data = await res.json();
  return c.json(data);
});
