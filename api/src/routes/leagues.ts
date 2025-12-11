// predictor-porto/api/src/routes/leagues.ts
import { Hono } from 'hono';

type Env = {
  DB: D1Database;
};

export const leagues = new Hono<{ Bindings: Env }>();

function jsonError(c: any, status: number, message: string) {
  return c.json({ error: message }, status);
}

/* ---------------------------------------------------
 * GET /api/leagues?userId=...
 * Ligas em que o utilizador participa
 * --------------------------------------------------- */
leagues.get('/leagues', async (c) => {
  const db = c.env.DB;
  const userId = c.req.query('userId');

  if (!userId) return jsonError(c, 400, 'Missing userId');

  const result = await db
    .prepare(
      `SELECT
         l.id,
         l.name,
         l.code,
         l.visibility,
         l.owner_id,
         m.role
       FROM league_members m
       JOIN leagues l ON l.id = m.league_id
       WHERE m.user_id = ?
       ORDER BY l.name`,
    )
    .bind(userId)
    .all();

  return c.json(result.results ?? []);
});

/* ---------------------------------------------------
 * GET /api/leagues/public?userId=...
 * Lista ligas públicas + se o user já é membro
 * --------------------------------------------------- */
leagues.get('/leagues/public', async (c) => {
  const db = c.env.DB;
  const userId = c.req.query('userId');

  if (!userId) return jsonError(c, 400, 'Missing userId');

  const result = await db
    .prepare(
      `
      SELECT
        l.id,
        l.name,
        l.code,
        l.visibility,
        l.owner_id,
        EXISTS (
          SELECT 1
          FROM league_members lm
          WHERE lm.league_id = l.id
            AND lm.user_id = ?
        ) AS is_member
      FROM leagues l
      WHERE l.visibility = 'public'
      ORDER BY l.name
      `,
    )
    .bind(userId)
    .all<{
      id: string;
      name: string;
      code: string;
      visibility: string;
      owner_id: string;
      is_member: number;
    }>();

  const rows =
    result.results?.map((r) => ({
      ...r,
      is_member: !!r.is_member,
    })) ?? [];

  return c.json(rows);
});

/* ---------------------------------------------------
 * POST /api/leagues
 * Body: { userId, name, visibility? }
 * --------------------------------------------------- */
leagues.post('/leagues', async (c) => {
  const db = c.env.DB;

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, 'Invalid JSON');
  }

  const userId = String(body.userId ?? '').trim();
  const name = String(body.name ?? '').trim();
  const visibility = (String(body.visibility ?? 'private').toLowerCase() ===
  'public'
    ? 'public'
    : 'private') as 'public' | 'private';

  if (!userId) return jsonError(c, 400, 'Missing userId');
  if (!name) return jsonError(c, 400, 'Missing name');

  const id = crypto.randomUUID();

  const code =
    (body.code as string | undefined)?.trim().toUpperCase() ||
    id.replace(/-/g, '').toUpperCase().slice(0, 6);

  await db.batch([
    db
      .prepare(
        `INSERT INTO leagues (id, owner_id, name, code, visibility)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, userId, name, code, visibility),
    db
      .prepare(
        `INSERT INTO league_members (league_id, user_id, role)
         VALUES (?, ?, ?)`,
      )
      .bind(id, userId, 'owner'),
  ]);

  return c.json(
    {
      id,
      name,
      code,
      visibility,
      owner_id: userId,
      role: 'owner',
    },
    201,
  );
});

/* ---------------------------------------------------
 * POST /api/leagues/join
 * Body: { userId, code }
 * OU query: ?userId=...&code=...
 * --------------------------------------------------- */
leagues.post('/leagues/join', async (c) => {
  const db = c.env.DB;

  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    // ok, pode vir tudo por query
  }

  const userId =
    String(body.userId ?? c.req.query('userId') ?? '').trim();
  const rawCode =
    String(body.code ?? c.req.query('code') ?? '').trim();

  if (!userId) return jsonError(c, 400, 'Missing userId');
  if (!rawCode) return jsonError(c, 400, 'Missing code');

  const code = rawCode.toUpperCase();

  const league = await db
    .prepare(
      `SELECT id, name, code, visibility, owner_id
       FROM leagues
       WHERE UPPER(code) = ?`,
    )
    .bind(code)
    .first<{
      id: string;
      name: string;
      code: string;
      visibility: string;
      owner_id: string;
    }>();

  if (!league) return jsonError(c, 404, 'Liga não encontrada');

  await db
    .prepare(
      `INSERT OR IGNORE INTO league_members (league_id, user_id, role)
       VALUES (?, ?, ?)`,
    )
    .bind(league.id, userId, 'member')
    .run();

  return c.json({
    ...league,
    role: userId === league.owner_id ? 'owner' : 'member',
  });
});

/* ---------------------------------------------------
 * GET /api/leagues/:leagueId
 * Detalhe + membros + role actual
 * --------------------------------------------------- */
leagues.get('/leagues/:leagueId', async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param('leagueId');
  const userId = c.req.query('userId');

  if (!userId) return jsonError(c, 400, 'Missing userId');

  const league = await db
    .prepare(
      `SELECT id, name, code, visibility, owner_id
       FROM leagues
       WHERE id = ?`,
    )
    .bind(leagueId)
    .first<{
      id: string;
      name: string;
      code: string;
      visibility: string;
      owner_id: string;
    }>();

  if (!league) return jsonError(c, 404, 'league_not_found');

  const membersRes = await db
    .prepare(
      `
      SELECT
        lm.user_id,
        lm.role,
        COALESCE(u.name,
          CASE
            WHEN u.email IS NULL THEN 'Jogador'
            ELSE substr(u.email, 1, instr(u.email, '@') - 1)
          END
        ) AS name
      FROM league_members lm
      JOIN users u ON u.id = lm.user_id
      WHERE lm.league_id = ?
      ORDER BY (lm.user_id = ?) DESC, lm.role DESC, name ASC
      `,
    )
    .bind(leagueId, userId)
    .all<{
      user_id: string;
      role: string;
      name: string | null;
    }>();

  const currentMembership = membersRes.results.find(
    (m) => m.user_id === userId,
  );
  const currentUserRole =
    (currentMembership?.role as 'owner' | 'member' | undefined) ?? null;

  return c.json({
    league,
    members: membersRes.results,
    currentUserRole,
  });
});

/* ---------------------------------------------------
 * PATCH /api/leagues/:leagueId  (apenas owner)
 * Body: { userId, name?, visibility? }
 * --------------------------------------------------- */
leagues.patch('/leagues/:leagueId', async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param('leagueId');

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, 'Invalid JSON');
  }

  const userId = String(body.userId ?? '').trim();
  const name = body.name != null ? String(body.name).trim() : undefined;
  const visibilityRaw =
    body.visibility != null ? String(body.visibility).toLowerCase() : undefined;

  if (!userId) return jsonError(c, 400, 'Missing userId');

  const league = await db
    .prepare(
      `SELECT id, owner_id
       FROM leagues
       WHERE id = ?`,
    )
    .bind(leagueId)
    .first<{ id: string; owner_id: string }>();

  if (!league) return jsonError(c, 404, 'league_not_found');
  if (league.owner_id !== userId)
    return jsonError(c, 403, 'not_owner');

  const updates: string[] = [];
  const params: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (visibilityRaw !== undefined) {
    const vis =
      visibilityRaw === 'public' ? 'public' : 'private';
    updates.push('visibility = ?');
    params.push(vis);
  }

  if (updates.length === 0) {
    return jsonError(c, 400, 'Nothing to update');
  }

  params.push(leagueId);

  await db
    .prepare(
      `UPDATE leagues
       SET ${updates.join(', ')}
       WHERE id = ?`,
    )
    .bind(...params)
    .run();

  return c.json({ ok: true });
});

/* ---------------------------------------------------
 * DELETE /api/leagues/:leagueId  (apenas owner)
 * --------------------------------------------------- */
leagues.delete('/leagues/:leagueId', async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param('leagueId');

  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    // ok
  }

  const userId = String(body.userId ?? '').trim();
  if (!userId) return jsonError(c, 400, 'Missing userId');

  const league = await db
    .prepare(
      `SELECT id, owner_id FROM leagues WHERE id = ?`,
    )
    .bind(leagueId)
    .first<{ id: string; owner_id: string }>();

  if (!league) return jsonError(c, 404, 'league_not_found');
  if (league.owner_id !== userId)
    return jsonError(c, 403, 'not_owner');

  await db.batch([
    db
      .prepare(
        `DELETE FROM league_members WHERE league_id = ?`,
      )
      .bind(leagueId),
    db
      .prepare(`DELETE FROM leagues WHERE id = ?`)
      .bind(leagueId),
  ]);

  return c.json({ ok: true });
});

/* ---------------------------------------------------
 * DELETE /api/leagues/:leagueId/members/:memberUserId
 * - Se userId === memberUserId → pode sair da liga.
 * - Caso contrário, só o owner pode remover.
 * Body: { userId }
 * --------------------------------------------------- */
leagues.delete('/leagues/:leagueId/members/:memberUserId', async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param('leagueId');
  const memberUserId = c.req.param('memberUserId');

  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    // ok
  }

  const userId = String(body.userId ?? '').trim();
  if (!userId) return jsonError(c, 400, 'Missing userId');

  const league = await db
    .prepare(
      `SELECT id, owner_id FROM leagues WHERE id = ?`,
    )
    .bind(leagueId)
    .first<{ id: string; owner_id: string }>();

  if (!league) return jsonError(c, 404, 'league_not_found');

  const isSelf = userId === memberUserId;
  const isOwner = league.owner_id === userId;

  if (!isSelf && !isOwner) {
    return jsonError(c, 403, 'forbidden');
  }

  await db
    .prepare(
      `DELETE FROM league_members
       WHERE league_id = ?
         AND user_id = ?`,
    )
    .bind(leagueId, memberUserId)
    .run();

  return c.json({ ok: true });
});

/* ---------------------------------------------------
 * GET /api/leagues/:leagueId/ranking
 * Ranking de pontos da liga
 * --------------------------------------------------- */
leagues.get('/leagues/:leagueId/ranking', async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param('leagueId');

  const league = await db
    .prepare(
      `SELECT id, name, code, visibility
       FROM leagues
       WHERE id = ?`,
    )
    .bind(leagueId)
    .first<{
      id: string;
      name: string;
      code: string;
      visibility: string;
    }>();

  if (!league) {
    return c.json({ error: 'league_not_found' }, 404);
  }

  const rows = await db
    .prepare(
      `
      SELECT
        u.id AS user_id,
        COALESCE(u.name,
                 CASE
                   WHEN u.email IS NULL THEN 'Jogador'
                   ELSE substr(u.email, 1, instr(u.email, '@') - 1)
                 END
        ) AS name,
        u.avatar_url,
        COALESCE(SUM(p.points), 0) AS total_points
      FROM league_members lm
      JOIN users u
        ON u.id = lm.user_id
      LEFT JOIN predictions p
        ON p.user_id = u.id
      WHERE lm.league_id = ?
      GROUP BY u.id, name, u.avatar_url
      ORDER BY total_points DESC, u.created_at ASC
      `,
    )
    .bind(leagueId)
    .all<{
      user_id: string;
      name: string;
      avatar_url: string | null;
      total_points: number;
    }>();

  const ranking =
    rows.results.map((row, idx) => ({
      ...row,
      position: idx + 1,
    })) ?? [];

  return c.json({
    league,
    ranking,
  });
});

export default leagues;
