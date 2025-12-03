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
 *   most_common_score: { home, away, count } | null,
 *   most_common_scorer: { player_id, name, count } | null
 * }
 */
fixtureTrends.get('/fixtures/:fixtureId/trends', async (c) => {
  const fixtureId = c.req.param('fixtureId');
  const db = c.env.DB;

  // total de palpites para o jogo
  const totalRow = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM predictions
       WHERE fixture_id = ?`,
    )
    .bind(fixtureId)
    .first<{ total: number }>();

  const total_predictions = totalRow?.total ?? 0;

  // resultado mais comum (home_goals-away_goals)
  const bestScore = await db
    .prepare(
      `SELECT home_goals, away_goals, COUNT(*) AS cnt
       FROM predictions
       WHERE fixture_id = ?
         AND home_goals IS NOT NULL
         AND away_goals IS NOT NULL
       GROUP BY home_goals, away_goals
       ORDER BY cnt DESC, home_goals DESC, away_goals DESC
       LIMIT 1`,
    )
    .bind(fixtureId)
    .first<{ home_goals: number; away_goals: number; cnt: number }>();

  // marcador mais escolhido
  const bestScorer = await db
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
       LIMIT 1`,
    )
    .bind(fixtureId)
    .first<{ player_id: string | number; player_name: string | null; cnt: number }>();

  return c.json({
    total_predictions,
    most_common_score: bestScore
      ? {
          home: bestScore.home_goals,
          away: bestScore.away_goals,
          count: bestScore.cnt,
        }
      : null,
    most_common_scorer: bestScorer
      ? {
          player_id: String(bestScorer.player_id),
          name: bestScorer.player_name ?? 'Desconhecido',
          count: bestScorer.cnt,
        }
      : null,
  });
});
