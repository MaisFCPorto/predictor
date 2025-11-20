// predictor-porto/api/src/routes/admin/players.ts
import { Hono } from 'hono';
import type { Env } from '../admin';
import { requireAdminKey } from '../admin';

export const adminPlayers = new Hono<{ Bindings: Env }>();

// Aplica o middleware a todos os métodos deste router
adminPlayers.use('*', requireAdminKey);

// GET /api/admin/players?team_id=fcp
adminPlayers.get('/', async (c) => {
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
  `,
  );

  const rs = await stmt.bind(teamId).all();
  return c.json(rs.results ?? []);
});
