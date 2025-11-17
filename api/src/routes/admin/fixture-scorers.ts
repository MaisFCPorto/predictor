// api/src/routes/admin/fixture-scorers.ts
import { Hono } from 'hono';

type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
};

export const adminFixtureScorers = new Hono<{ Bindings: Env }>();

// Middleware simples para validar admin
function requireAdmin(c: any) {
  const key = c.req.header('x-admin-key');
  if (!key || key !== c.env.ADMIN_KEY) {
    return c.json({ error: 'forbidden' }, 403);
  }
  return null;
}

// GET /api/admin/fixtures/:id/scorers
adminFixtureScorers.get('/:id/scorers', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;

  const fixtureId = c.req.param('id');

  const { results } = await c.env.DB
    .prepare(
      `SELECT fs.player_id, p.name, p.position
       FROM fixture_scorers fs
       JOIN players p ON p.id = fs.player_id
       WHERE fs.fixture_id = ?
       ORDER BY p.name`
    )
    .bind(fixtureId)
    .all();

  return c.json(results ?? []);
});

// PUT /api/admin/fixtures/:id/scorers
adminFixtureScorers.put('/:id/scorers', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;

  const fixtureId = c.req.param('id');
  const body = await c.req.json().catch(() => null);

  if (!body || !Array.isArray(body.player_ids)) {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const playerIds: string[] = body.player_ids;

  // Limpar marcadores anteriores
  await c.env.DB
    .prepare(`DELETE FROM fixture_scorers WHERE fixture_id = ?`)
    .bind(fixtureId)
    .run();

  // Inserir novos
  for (const pid of playerIds) {
    await c.env.DB
      .prepare(
        `INSERT INTO fixture_scorers (id, fixture_id, player_id)
         VALUES (lower(hex(randomblob(16))), ?, ?)`
      )
      .bind(fixtureId, pid)
      .run();
  }

  return c.json({ ok: true, count: playerIds.length });
});
