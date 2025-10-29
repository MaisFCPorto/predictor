// apps/api/src/routes/admin/competitions.ts
import { Hono } from 'hono';
type Env = { DB: D1Database; ADMIN_KEY: string };

export const adminCompetitions = new Hono<{ Bindings: Env }>();

adminCompetitions.get('/', async (c) => {
  const key = c.req.header('x-admin-key');
  if (!key || key !== c.env.ADMIN_KEY) {
    return c.json({ error: 'forbidden' }, 403);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT id, code, name FROM competitions ORDER BY name`
  ).all<{ id: string; code: string; name: string }>();
  return c.json(results ?? []);
});
