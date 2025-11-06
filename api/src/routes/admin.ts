// predictor-porto/api/src/routes/admin.ts
import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

type Env = {
  DB: D1Database
  ADMIN_KEY: string
  FOOTBALL_DATA_TOKEN: string
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
admin.get('/teams', requireAdminKey, async (c) => {
    const { results } = await c.env.DB
      .prepare(`SELECT id, name FROM teams ORDER BY name`)
      .all();
    return c.json(results);
  });
  
  // --- NOVO: lista de competições
  admin.get('/competitions', requireAdminKey, async (c) => {
    const { results } = await c.env.DB
      .prepare(`SELECT id, code, name FROM competitions ORDER BY name`)
      .all();
    return c.json(results);
  });

admin.get('/fixtures/porto', requireAdminKey, async (c) => {
  const token = (c.env.FOOTBALL_DATA_TOKEN || '').trim()
  if (!token) return c.json({ error: 'missing token' }, 500)

  const url = 'https://api.football-data.org/v4/teams/503/matches?status=SCHEDULED'
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Auth-Token': token,
      'accept': 'application/json',
    },
    redirect: 'manual',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let body: any
    try { body = JSON.parse(text) } catch { body = text }
    const status = (res.status === 204 || res.status === 205 || res.status === 304) ? 500 : res.status
    return c.json({ error: 'upstream', status: res.status, body }, status as ContentfulStatusCode)
  }

  const data = await res.json()
  return c.json(data)
})
