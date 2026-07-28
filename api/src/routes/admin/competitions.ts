// apps/api/src/routes/admin/competitions.ts
import { Hono } from 'hono';
import { requireAdminKey, type Env } from '../admin';

export const adminCompetitions = new Hono<{ Bindings: Env }>();

adminCompetitions.use('*', requireAdminKey);

adminCompetitions.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, code, name FROM competitions ORDER BY name`
  ).all<{ id: string; code: string; name: string }>();
  return c.json(results ?? []);
});
