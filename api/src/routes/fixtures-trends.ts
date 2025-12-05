// predictor-porto/api/src/routes/fixtures-trends.ts
import { Hono } from 'hono';

type Env = {
  DB: D1Database;
};

export const fixtureTrends = new Hono<{ Bindings: Env }>();

/**
 * GET /api/fixtures/:fixtureId/trends
 *
 * Responde:
 * {
 *   total_predictions: number,
 *   scores: { home, away, count, pct }[],
 *   scorers: { player_id, name, count, pct }[],
 *   // campos "legados" para compat (opcional usar no front)
 *   most_common_score?: { home, away, count, pct } | null,
 *   most_common_scorer?: { player_id, name, count, pct } | null
 * }
 */
fixtureTrends.get('/fixtures/:fixtureId/trends', async (c) => {
  const fixtureId = c.req.param('fixtureId');
  const db = c.env.DB;

  // 1) Total de palpites
  const totalRow = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM predictions
       WHERE fixture_id = ?`,
    )
    .bind(fixtureId)
    .first<{ total: number }>();

  const total_predictions = totalRow?.total ?? 0;

  // 2) Top 3 resultados mais comuns
  const { results: scoreRows } = await db
    .prepare(
      `SELECT home_goals, away_goals, COUNT(*) AS cnt
       FROM predictions
       WHERE fixture_id = ?
         AND home_goals IS NOT NULL
         AND away_goals IS NOT NULL
       GROUP BY home_goals, away_goals
       ORDER BY cnt DESC, home_goals DESC, away_goals DESC
       LIMIT 3`,
    )
    .bind(fixtureId)
    .all<{ home_goals: number; away_goals: number; cnt: number }>();

  const scores =
    (scoreRows ?? []).map((row) => {
      const count = row.cnt ?? 0;
      const pct =
        total_predictions > 0
          ? Math.round((count * 100) / total_predictions)
          : 0;
      return {
        home: row.home_goals,
        away: row.away_goals,
        count,
        pct,
      };
    }) ?? [];

  // 3) Top 3 marcadores mais escolhidos
  const { results: scorerRows } = await db
    .prepare(
      `SELECT p.scorer_player_id AS player_id,
              pl.name AS player_name,
              COUNT(*) AS cnt
       FROM predictions p
       LEFT JOIN players pl ON pl.id = p.scorer_player_id
       WHERE p.fixture_id = ?
         AND p.scorer_player_id IS NOT NULL
       GROUP BY p.scorer_player_id, pl.name
       ORDER BY cnt DESC, player_name ASC
       LIMIT 3`,
    )
    .bind(fixtureId)
    .all<{ player_id: string | number; player_name: string | null; cnt: number }>();

  const scorers =
    (scorerRows ?? []).map((row) => {
      const count = row.cnt ?? 0;
      const pct =
        total_predictions > 0
          ? Math.round((count * 100) / total_predictions)
          : 0;
      return {
        player_id: String(row.player_id),
        name: row.player_name ?? 'Desconhecido',
        count,
        pct,
      };
    }) ?? [];

  // 4) Resposta
  return c.json({
    total_predictions,
    scores,
    scorers,
    // campos "single" só por conveniência / retrocompat
    most_common_score: scores[0] ?? null,
    most_common_scorer: scorers[0] ?? null,
  });
});
