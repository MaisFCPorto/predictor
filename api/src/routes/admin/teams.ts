// predictor-porto/api/src/routes/admin/teams.ts
import { Hono } from 'hono';
import type { Context } from 'hono';

type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
};

export const adminTeams = new Hono<{ Bindings: Env }>();

/* ----------------- Helpers comuns ----------------- */

function requireAdmin(c: Context<{ Bindings: Env }>): Response | undefined {
  const need = c.env.ADMIN_KEY;
  if (!need) return undefined; // em dev, sem chave → ignora

  const got = c.req.header('x-admin-key');
  if (!got || got !== need) {
    return c.json({ error: 'forbidden' }, 403);
  }
  return undefined;
}

const run = (db: D1Database, sql: string, ...args: unknown[]) =>
  db.prepare(sql).bind(...args).run();

const all = <T>(db: D1Database, sql: string, ...args: unknown[]) =>
  db.prepare(sql).bind(...args).all<T>();

/* ----------------- Tipos ----------------- */

type TeamRow = {
  id: string;
  name: string;
  short_name: string | null;
  crest_url: string | null;
};

/* ----------------- Rotas ----------------- */

// LISTAR equipas
adminTeams.get('/', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;

  const { results } = await all<TeamRow>(
    c.env.DB,
    `
    SELECT
      id,
      name,
      short_name,
      crest_url
    FROM teams
    ORDER BY name
    `,
  );

  return c.json(results ?? []);
});

// CRIAR equipa
adminTeams.post('/', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;

  const body = (await c.req.json().catch(() => null)) as
    | { id?: string; name?: string; short_name?: string; crest_url?: string }
    | null;

  if (!body?.id || !body?.name) {
    return c.json({ error: 'missing_id_or_name' }, 400);
  }

  await run(
    c.env.DB,
    `
    INSERT INTO teams (id, name, short_name, crest_url)
    VALUES (?, ?, ?, ?)
    `,
    body.id.trim(),
    body.name.trim(),
    body.short_name?.trim() || null,
    body.crest_url?.trim() || null,
  );

  return c.json({ ok: true });
});

// ATUALIZAR equipa
adminTeams.patch('/:id', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;

  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as
    | { name?: string; short_name?: string | null; crest_url?: string | null }
    | null;

  if (!id) return c.json({ error: 'missing_id' }, 400);
  if (!body) return c.json({ error: 'invalid_json' }, 400);

  await run(
    c.env.DB,
    `
    UPDATE teams
    SET
      name       = COALESCE(?, name),
      short_name = COALESCE(?, short_name),
      crest_url  = COALESCE(?, crest_url)
    WHERE id = ?
    `,
    body.name ?? null,
    body.short_name ?? null,
    body.crest_url ?? null,
    id,
  );

  return c.json({ ok: true });
});

// APAGAR equipa (+ fixtures associadas)
adminTeams.delete('/:id', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;

  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing_id' }, 400);

  // Apaga fixtures onde esta equipa participa
  await run(
    c.env.DB,
    `
    DELETE FROM fixtures
    WHERE home_team_id = ? OR away_team_id = ?
    `,
    id,
    id,
  );

  // Apaga a própria equipa
  await run(c.env.DB, `DELETE FROM teams WHERE id = ?`, id);

  return c.json({ ok: true });
});

export default adminTeams;
