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
    .all<{ player_id: string; name: string; position: string }>();

  return c.json(results ?? []);
});

// PUT /api/admin/fixtures/:id/scorers
adminFixtureScorers.put('/:id/scorers', async (c) => {
  const fixtureId = c.req.param('id');
  const body = await c.req.json<{ player_ids?: string[] | null }>().catch(() => ({
    player_ids: [],
  }));

  const playerIds = Array.isArray(body.player_ids) ? body.player_ids : [];

  const db = c.env.DB;

  // Limpa marcadores atuais
  await db
    .prepare('DELETE FROM fixture_scorers WHERE fixture_id = ?')
    .bind(fixtureId)
    .run();

  // Insere novos
  for (const pid of playerIds) {
    await db
      .prepare(
        `
        INSERT INTO fixture_scorers (fixture_id, player_id)
        VALUES (?, ?)
      `,
      )
      .bind(fixtureId, pid)
      .run();
  }

  // Recalcular pontos de todas as predictions desse jogo
  await recomputePointsForFixture(db, fixtureId);

  return c.json({ ok: true, count: playerIds.length });
});
