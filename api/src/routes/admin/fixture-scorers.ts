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

  const body = await c.req.json<{ player_ids?: (string | number)[] }>().catch(() => ({
    player_ids: [],
  }));

  const rawIds = body.player_ids ?? [];
  const ids = rawIds
    .map((x) => String(x).trim())
    .filter((x) => x.length > 0);

  const db = c.env.DB;

  // Limpa marcadores existentes
  await db
    .prepare(`DELETE FROM fixture_scorers WHERE fixture_id = ?`)
    .bind(fixtureId)
    .run();

  // Insere novos
  for (const pid of ids) {
    await db
      .prepare(
        `
        INSERT INTO fixture_scorers (fixture_id, player_id, created_at)
        VALUES (?, ?, datetime('now'))
      `,
      )
      .bind(fixtureId, pid)
      .run();
  }

  // Recalcula pontos das predictions deste jogo (incluindo bónus de marcador)
  await recomputePointsForFixture(db, fixtureId);

  return c.json({ ok: true, fixture_id: fixtureId, player_ids: ids });
});
