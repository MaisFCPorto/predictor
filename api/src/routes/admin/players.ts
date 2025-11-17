// api/src/routes/admin/players.ts
import { Hono } from 'hono';

type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
};

export const adminPlayers = new Hono<{ Bindings: Env }>();

// GET /admin/players?team_id=fcp
adminPlayers.get('/', async (c) => {
  // valida admin key
  const key = c.req.header('x-admin-key');
  if (!key || key !== c.env.ADMIN_KEY) {
    return c.json({ error: 'forbidden' }, 403);
  }

  // default: fcp
  const teamId = c.req.query('team_id') ?? 'fcp';

  const stmt = c.env.DB.prepare(
    `
    SELECT id, team_id, name, position
    FROM players
    WHERE team_id = ?
    ORDER BY
      CASE position
        WHEN 'GR' THEN 1
        WHEN 'D'  THEN 2
        WHEN 'M'  THEN 3
        WHEN 'A'  THEN 4
        ELSE 5
      END,
      name
    `
  );

  const rs = await stmt.bind(teamId).all();

  return c.json(rs.results ?? []);
});
