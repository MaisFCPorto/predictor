// predictor-porto/api/src/routes/admin/leagues.ts
import { Hono } from 'hono';
import type { Context } from 'hono';

type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
};

export const adminLeagues = new Hono<{ Bindings: Env }>();

// Middleware simples para validar ADMIN_KEY (mesmo que uses noutros admin routers)
adminLeagues.use('/*', async (c, next) => {
  const sent = c.req.header('x-admin-key') || '';
  if (!sent || sent !== c.env.ADMIN_KEY) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});

// GET /api/admin/leagues -> lista básica com contagem de membros
adminLeagues.get('/leagues', async (c) => {
  const db = c.env.DB;

  const rows = await db
    .prepare(
      `
      SELECT
        l.*,
        COUNT(m.user_id) AS member_count
      FROM leagues l
      LEFT JOIN league_members m ON m.league_id = l.id
      GROUP BY l.id
      ORDER BY l.created_at DESC
      `
    )
    .all<any>();

  return c.json(rows.results ?? []);
});

// POST /api/admin/leagues -> cria liga + adiciona owner como membro
adminLeagues.post('/leagues', async (c) => {
  const db = c.env.DB;

  const body = await c.req.json().catch(() => ({}));
  const name = (body.name ?? '').trim();
  const owner_user_id = (body.owner_user_id ?? '').trim();
  const start_mode = (body.start_mode ?? 'from_created') as string;
  const start_date = body.start_date ?? null;
  const start_fixture_id = body.start_fixture_id ?? null;
  const competition_code = body.competition_code ?? null;

  if (!name || !owner_user_id) {
    return c.json(
      { error: 'name and owner_user_id are required' },
      400,
    );
  }

  // gera uuid simples
  const id = crypto.randomUUID();

  // gera join_code curto
  const join_code = Math.random().toString(36).slice(2, 8).toUpperCase();

  // transação simples
  const now = new Date().toISOString();

  await db.batch([
    db
      .prepare(
        `INSERT INTO leagues (
          id, name, owner_user_id, join_code, visibility,
          start_mode, start_date, start_fixture_id, competition_code, created_at
        )
        VALUES (?, ?, ?, ?, 'private', ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        name,
        owner_user_id,
        join_code,
        start_mode,
        start_date,
        start_fixture_id,
        competition_code,
        now,
      ),
    db
      .prepare(
        `INSERT INTO league_members (league_id, user_id, joined_at, is_owner)
         VALUES (?, ?, ?, 1)`
      )
      .bind(id, owner_user_id, now),
  ]);

  return c.json({
    id,
    name,
    owner_user_id,
    join_code,
    start_mode,
    start_date,
    start_fixture_id,
    competition_code,
    created_at: now,
  });
});

// GET /api/admin/leagues/:leagueId -> detalhe + membros
adminLeagues.get('/leagues/:leagueId', async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param('leagueId');

  const league = await db
    .prepare('SELECT * FROM leagues WHERE id = ?')
    .bind(leagueId)
    .first<any>();

  if (!league) {
    return c.json({ error: 'not_found' }, 404);
  }

  const members = await db
    .prepare(
      `
      SELECT lm.user_id, lm.joined_at, lm.is_owner,
             u.name, u.email
      FROM league_members lm
      LEFT JOIN users u ON u.id = lm.user_id
      WHERE lm.league_id = ?
      ORDER BY lm.is_owner DESC, lm.joined_at ASC
      `,
    )
    .bind(leagueId)
    .all<any>();

  return c.json({
    league,
    members: members.results ?? [],
  });
});
