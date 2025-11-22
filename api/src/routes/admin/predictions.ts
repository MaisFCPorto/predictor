// predictor-porto/api/src/routes/admin/predictions.ts
import { Hono } from 'hono';

type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
};

export const adminPredictions = new Hono<{ Bindings: Env }>();

// Middleware de auth simples (igual ao resto do admin)
adminPredictions.use('*', async (c, next) => {
  const need = c.env.ADMIN_KEY;
  if (!need) {
    // em dev sem chave, deixa passar
    await next();
    return;
  }

  const got = c.req.header('x-admin-key');
  if (!got || got !== need) {
    return c.json({ error: 'forbidden' }, 403);
  }

  await next();
});

/**
 * GET /api/admin/predictions/fixtures
 * Lista de jogos para usar no selector do admin
 */
adminPredictions.get('/fixtures', async (c) => {
  const db = c.env.DB;

  const { results } = await db
    .prepare(
      `
      SELECT
        f.id,
        f.kickoff_at,
        ht.name AS home_team_name,
        at.name AS away_team_name
      FROM fixtures f
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      ORDER BY f.kickoff_at DESC
    `,
    )
    .all<{
      id: string;
      kickoff_at: string;
      home_team_name: string;
      away_team_name: string;
    }>();

  const fixtures = (results ?? []).map((row) => {
    const d = new Date(row.kickoff_at);
    const dateLabel = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const label = `${dateLabel} – ${row.home_team_name} vs ${row.away_team_name}`;
    return {
      id: row.id,
      label,
    };
  });

  return c.json({ fixtures });
});

/**
 * GET /api/admin/predictions/fixture/:fixtureId
 * Lista todas as predictions (resultado + marcador + user) de um jogo
 */
adminPredictions.get('/fixture/:fixtureId', async (c) => {
  const db = c.env.DB;
  const fixtureId = c.req.param('fixtureId');

  if (!fixtureId) {
    return c.json({ error: 'missing_fixture_id' }, 400);
  }

  const { results } = await db
    .prepare(
      `
      SELECT
        p.id,
        p.fixture_id,
        p.user_id,
        p.home_goals     AS pred_home,
        p.away_goals     AS pred_away,
        p.scorer_player_id,
        p.created_at,
        u.name           AS user_name,
        pl.name          AS scorer_name
      FROM predictions p
      JOIN users u
        ON u.id = p.user_id
      LEFT JOIN players pl
        ON pl.id = p.scorer_player_id
      WHERE p.fixture_id = ?
      ORDER BY p.created_at ASC
    `,
    )
    .bind(fixtureId)
    .all<{
      id: string;
      fixture_id: string;
      user_id: string;
      pred_home: number | null;
      pred_away: number | null;
      scorer_player_id: string | null;
      created_at: string;
      user_name: string | null;
      scorer_name: string | null;
    }>();

  const predictions = (results ?? []).map((row) => ({
    id: row.id,
    user_name: row.user_name ?? '(sem nome)',
    pred_home: row.pred_home,
    pred_away: row.pred_away,
    pred_scorer_name: row.scorer_name, // <- nome do marcador para o front
    created_at: row.created_at,
  }));

  return c.json({ predictions });
});
