// predictor-porto/api/src/routes/admin/predictions.ts
import { Hono } from 'hono';
import type { Context } from 'hono';

type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
};

export const adminPredictions = new Hono<{ Bindings: Env }>();

// Middleware simples de auth por header (igual ao que já usas no resto do admin)
adminPredictions.use('*', async (c, next) => {
  const key = c.req.header('x-admin-key');
  if (!key || key !== c.env.ADMIN_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

/**
 * GET /admin/predictions/fixtures
 * -> lista de jogos para o selector (id + label)
 */
adminPredictions.get('/fixtures', async (c) => {
  const db = c.env.DB;

  const { results } = await db
    .prepare(
      `
      SELECT
        f.id,
        f.kickoff_at,
        f.home_team_name,
        f.away_team_name
      FROM fixtures f
      ORDER BY f.kickoff_at DESC
    `
    )
    .all<{
      id: string;
      kickoff_at: string;
      home_team_name: string;
      away_team_name: string;
    }>();

  const fixtures = (results ?? []).map((row) => {
    const d = new Date(row.kickoff_at);
    const dateLabel = d.toISOString().slice(0, 10); // 2025-11-20
    const label = `${dateLabel} – ${row.home_team_name} vs ${row.away_team_name}`;
    return {
      id: row.id,
      label,
      kickoff_at: row.kickoff_at,
      home_team_name: row.home_team_name,
      away_team_name: row.away_team_name,
    };
  });

  return c.json({ fixtures });
});

/**
 * GET /admin/predictions/fixture/:fixtureId
 * -> lista todas as predictions (resultado + marcador + user) para um jogo
 */
adminPredictions.get('/fixture/:fixtureId', async (c) => {
  const db = c.env.DB;
  const fixtureId = c.req.param('fixtureId');

  if (!fixtureId) {
    return c.json({ error: 'Missing fixtureId' }, 400);
  }

  const { results } = await db
    .prepare(
      `
      SELECT
        fp.id,
        fp.fixture_id,
        fp.user_id,
        fp.pred_home,
        fp.pred_away,
        fp.pred_scorer_id,
        fp.created_at,
        u.name       AS user_name,
        u.username   AS username,
        p.name       AS scorer_name
      FROM predictions fp
      INNER JOIN users u
        ON u.id = fp.user_id
      LEFT JOIN players p
        ON p.id = fp.pred_scorer_id
      WHERE fp.fixture_id = ?
      ORDER BY fp.created_at ASC
    `
    )
    .bind(fixtureId)
    .all<{
      id: string;
      fixture_id: string;
      user_id: string;
      pred_home: number | null;
      pred_away: number | null;
      pred_scorer_id: string | null;
      created_at: string;
      user_name: string | null;
      username: string | null;
      scorer_name: string | null;
    }>();

  const predictions = (results ?? []).map((row) => ({
    id: row.id,
    fixture_id: row.fixture_id,
    user_id: row.user_id,
    user_name: row.user_name ?? '(sem nome)',
    username: row.username ?? '',
    pred_home: row.pred_home,
    pred_away: row.pred_away,
    pred_scorer_id: row.pred_scorer_id,
    scorer_name: row.scorer_name,
    created_at: row.created_at,
  }));

  return c.json({ predictions });
});
