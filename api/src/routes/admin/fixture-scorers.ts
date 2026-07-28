// predictor-porto/api/src/routes/admin/fixture-scorers.ts
import { Hono } from 'hono';
import type { Env } from '../admin';
import { requireAdminKey, recomputePointsForFixture } from '../admin';

export const adminFixtureScorers = new Hono<{ Bindings: Env }>();

// Middleware admin em todas as rotas deste router
adminFixtureScorers.use('*', requireAdminKey);

// GET /api/admin/fixtures/:id/scorers
adminFixtureScorers.get('/:id/scorers', async (c) => {
  const fixtureId = c.req.param('id');

  const { results } = await c.env.DB
    .prepare(
      `
      SELECT fs.player_id, p.name, p.position
      FROM fixture_scorers fs
      JOIN players p ON p.id = fs.player_id
      WHERE fs.fixture_id = ?
      ORDER BY p.name
    `,
    )
    .bind(fixtureId)
    .all<{ player_id: string; name: string; position: string | null }>();

  return c.json(results ?? []);
});

// PUT /api/admin/fixtures/:id/scorers
// body: { player_ids: string[] }
// Substitui os marcadores desse jogo e recalcula pontos das predictions
adminFixtureScorers.put('/:id/scorers', async (c) => {
  const fixtureId = c.req.param('id');

  const body = await c.req
    .json<{ player_ids?: (string | number)[] }>()
    .catch(() => ({ player_ids: [] }));

  const ids = [
    ...new Set(
      (body.player_ids ?? [])
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  ];

  const db = c.env.DB;

  const statements = [
    db
      .prepare(`DELETE FROM fixture_scorers WHERE fixture_id = ?`)
      .bind(fixtureId),

    ...ids.map((playerId) =>
      db
        .prepare(`
          INSERT INTO fixture_scorers (
            id,
            fixture_id,
            player_id,
            created_at
          )
          VALUES (
            lower(hex(randomblob(16))),
            ?,
            ?,
            datetime('now')
          )
        `)
        .bind(fixtureId, playerId),
    ),
  ];

  await db.batch(statements);
  await recomputePointsForFixture(db, fixtureId);

  return c.json({
    ok: true,
    fixture_id: fixtureId,
    player_ids: ids,
  });
});
