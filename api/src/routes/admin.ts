// predictor-porto/api/src/routes/admin.ts
import { Hono } from 'hono'

type Env = {
  DB: D1Database
  ADMIN_KEY: string
}

// Middleware: exige header x-admin-key (chave guardada no Worker)
const requireAdminKey: import('hono').MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const key = c.req.header('x-admin-key')
  if (!key || key !== c.env.ADMIN_KEY) return c.json({ error: 'forbidden' }, 403)
  await next()
}

// Exporta um router Hono (não a app global)
export const admin = new Hono<{ Bindings: Env }>()

admin.get('/health', (c) => c.json({ ok: true }))

admin.get('/role', requireAdminKey, async (c) => {
  const email = c.req.query('email')
  if (!email) return c.json({ error: 'email required' }, 400)

  const row = await c.env.DB
    .prepare('SELECT role FROM users WHERE email = ?')
    .bind(email)
    .first<{ role: string }>()

  return c.json({ role: row?.role ?? 'user' })
})
// --- NOVO: lista de equipas
admin.get('/api/admin/teams', requireAdminKey, async (c) => {
    const { results } = await c.env.DB
      .prepare(`SELECT id, name FROM teams ORDER BY name`)
      .all();
    return c.json(results);
  });
  
  // --- NOVO: lista de competições
  admin.get('/api/admin/competitions', requireAdminKey, async (c) => {
    const { results } = await c.env.DB
      .prepare(`SELECT id, code, name FROM competitions ORDER BY name`)
      .all();
    return c.json(results);
  });