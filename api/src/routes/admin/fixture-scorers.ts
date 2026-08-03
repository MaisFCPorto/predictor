// predictor-porto/api/src/routes/admin/fixture-scorers.ts
import { Hono } from 'hono';
import type { Env } from '../admin';
import { requireAdminKey, recomputePointsForFixture } from '../admin';
import { normalizePlayerId, toPositivePlayerId } from '../../scorer-id';

export const adminFixtureScorers = new Hono<{ Bindings: Env }>();

// Middleware admin em todas as rotas deste router
adminFixtureScorers.use('*', requireAdminKey);

// GET /api/admin/fixtures/scorers-summary?fixture_ids=id1,id2
// Devolve os nomes dos marcadores para vários jogos numa única chamada.
adminFixtureScorers.get('/scorers-summary', async (c) => {
  const fixtureIds = [
    ...new Set(
      (c.req.query('fixture_ids') ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].slice(0, 100);

  if (fixtureIds.length === 0) return c.json([]);

  const placeholders = fixtureIds.map(() => '?').join(', ');
  const { results } = await c.env.DB
    .prepare(
      `
      SELECT fs.fixture_id, fs.player_id, p.name, p.position
      FROM fixture_scorers fs
      JOIN players p ON p.id = CAST(fs.player_id AS INTEGER)
      WHERE fs.fixture_id IN (${placeholders})
      ORDER BY fs.fixture_id, p.name
    `,
    )
    .bind(...fixtureIds)
    .all<{
      fixture_id: string;
      player_id: number;
      name: string;
      position: string | null;
    }>();

  return c.json(results ?? []);
});

// GET /api/admin/fixtures/:id/scorers
adminFixtureScorers.get('/:id/scorers', async (c) => {
  const fixtureId = c.req.param('id');

  const { results } = await c.env.DB
    .prepare(
      `
      SELECT fs.player_id, p.name, p.position
      FROM fixture_scorers fs
      JOIN players p ON p.id = CAST(fs.player_id AS INTEGER)
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
        .map(toPositivePlayerId)
        .filter((value): value is number => value != null),
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
            abs(random()),
            ?,
            ?,
            datetime('now')
          )
        `)
        .bind(fixtureId, normalizePlayerId(playerId)),
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
