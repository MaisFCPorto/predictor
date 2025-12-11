// predictor-porto/api/src/routes/leagues.ts
import { Hono } from 'hono';

type Env = {
  DB: D1Database;
};

export const leagues = new Hono<{ Bindings: Env }>();

/**
 * Helper: constrói erro JSON simples
 */
function jsonError(c: any, status: number, message: string) {
  return c.json({ error: message }, status);
}

/* ======================================================================
   1) LISTAR LIGAS DO UTILIZADOR
   GET /api/leagues?userId=...
====================================================================== */

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

/* ======================================================================
   2) CRIAR LIGA
   POST /api/leagues
   Body: { userId: string, name: string, visibility?: 'public' | 'private' }
====================================================================== */

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
  const visibility = (String(body.visibility ?? 'private').toLowerCase() === 'public'
    ? 'public'
    : 'private') as 'public' | 'private';

  if (!userId) return jsonError(c, 400, 'Missing userId');
  if (!name) return jsonError(c, 400, 'Missing name');

  const id = crypto.randomUUID();

  // código curto para partilhar com amigos (6 chars)
  const code =
    (body.code as string | undefined)?.trim().toUpperCase() ||
    id.replace(/-/g, '').toUpperCase().slice(0, 6);

  // inserir liga + membership numa batch
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

/* ======================================================================
   3) ENTRAR POR CÓDIGO
   POST /api/leagues/join
   Body: { userId: string, code: string }
====================================================================== */

leagues.post('/leagues/join', async (c) => {
  const db = c.env.DB;

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, 'Invalid JSON');
  }

  const userId = String(body.userId ?? '').trim();
  const rawCode = String(body.code ?? '').trim();

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

  // inserir membership se ainda não existir
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

/* ======================================================================
   4) DETALHE DA LIGA
   GET /api/leagues/:leagueId?userId=...
   Devolve info da liga + membros + role do utilizador.
====================================================================== */

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

  const membersResult = await db
    .prepare(
      `SELECT
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
       ORDER BY
         CASE WHEN lm.role = 'owner' THEN 0 ELSE 1 END,
         name`,
    )
    .bind(leagueId)
    .all<{
      user_id: string;
      role: string;
      name: string | null;
    }>();

  const members = membersResult.results ?? [];

  const myMembership = members.find((m) => m.user_id === userId) || null;
  const currentUserRole = (myMembership?.role as 'owner' | 'member' | undefined) ?? null;

  return c.json({
    league,
    members,
    currentUserRole,
  });
});

/* ======================================================================
   5) EDITAR LIGA (owner)
   PATCH /api/leagues/:leagueId
   Body: { userId, name?, visibility? }
====================================================================== */

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
  const name = (body.name ?? '').toString().trim();
  const rawVisibility = (body.visibility ?? '').toString().toLowerCase();
  const visibility =
    rawVisibility === 'public' ? 'public' : rawVisibility === 'private' ? 'private' : null;

  if (!userId) return jsonError(c, 400, 'Missing userId');

  const membership = await db
    .prepare(
      `SELECT role FROM league_members
       WHERE league_id = ? AND user_id = ?`,
    )
    .bind(leagueId, userId)
    .first<{ role: string }>();

  if (!membership || membership.role !== 'owner') {
    return jsonError(c, 403, 'only_owner_can_edit');
  }

  if (!name && !visibility) {
    return jsonError(c, 400, 'Nothing to update');
  }

  const fields: string[] = [];
  const params: any[] = [];

  if (name) {
    fields.push('name = ?');
    params.push(name);
  }
  if (visibility) {
    fields.push('visibility = ?');
    params.push(visibility);
  }

  params.push(leagueId);

  await db
    .prepare(
      `UPDATE leagues
       SET ${fields.join(', ')}
       WHERE id = ?`,
    )
    .bind(...params)
    .run();

  const updated = await db
    .prepare(
      `SELECT id, name, code, visibility, owner_id
       FROM leagues
       WHERE id = ?`,
    )
    .bind(leagueId)
    .first();

  return c.json(updated);
});

/* ======================================================================
   6) APAGAR LIGA (owner)
   DELETE /api/leagues/:leagueId
   Body: { userId }
====================================================================== */

leagues.delete('/leagues/:leagueId', async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param('leagueId');

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, 'Invalid JSON');
  }

  const userId = String(body.userId ?? '').trim();
  if (!userId) return jsonError(c, 400, 'Missing userId');

  const membership = await db
    .prepare(
      `SELECT role FROM league_members
       WHERE league_id = ? AND user_id = ?`,
    )
    .bind(leagueId, userId)
    .first<{ role: string }>();

  if (!membership || membership.role !== 'owner') {
    return jsonError(c, 403, 'only_owner_can_delete');
  }

  await db.batch([
    db.prepare(`DELETE FROM league_members WHERE league_id = ?`).bind(leagueId),
    db.prepare(`DELETE FROM leagues WHERE id = ?`).bind(leagueId),
  ]);

  return c.json({ ok: true });
});

/* ======================================================================
   7) REMOVER MEMBRO / SAIR DA LIGA
   DELETE /api/leagues/:leagueId/members/:memberUserId
   Body: { userId }
   - owner pode remover qualquer membro
   - qualquer utilizador pode remover-se a si próprio (sair da liga)
====================================================================== */

leagues.delete('/leagues/:leagueId/members/:memberUserId', async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param('leagueId');
  const memberUserId = c.req.param('memberUserId');

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, 'Invalid JSON');
  }

  const userId = String(body.userId ?? '').trim();
  if (!userId) return jsonError(c, 400, 'Missing userId');

  // membership de quem está a fazer a operação
  const membership = await db
    .prepare(
      `SELECT role
       FROM league_members
       WHERE league_id = ? AND user_id = ?`,
    )
    .bind(leagueId, userId)
    .first<{ role: string }>();

  if (!membership) {
    return jsonError(c, 403, 'not_member');
  }

  const isOwner = membership.role === 'owner';
  const isSelf = userId === memberUserId;

  // se não é owner, só pode remover-se a si próprio
  if (!isOwner && !isSelf) {
    return jsonError(c, 403, 'forbidden');
  }

  await db
    .prepare(
      `DELETE FROM league_members
       WHERE league_id = ? AND user_id = ?`,
    )
    .bind(leagueId, memberUserId)
    .run();

  // se a liga ficou sem membros, apaga-a automaticamente
  const remaining = await db
    .prepare(
      `SELECT COUNT(*) as cnt
       FROM league_members
       WHERE league_id = ?`,
    )
    .bind(leagueId)
    .first<{ cnt: number }>();

  if (!remaining || remaining.cnt === 0) {
    await db.prepare(`DELETE FROM leagues WHERE id = ?`).bind(leagueId).run();
  }

  return c.json({ ok: true });
});

/* ======================================================================
   8) RANKING DA LIGA
   GET /api/leagues/:leagueId/ranking
====================================================================== */

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
    return jsonError(c, 404, 'league_not_found');
  }

  const rows = await db
    .prepare(
      `
      SELECT
        u.id AS user_id,
        COALESCE(
          u.name,
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

  const ranking = (rows.results ?? []).map((row, idx) => ({
    ...row,
    position: idx + 1,
  }));

  return c.json({
    league,
    ranking,
  });
});

export default leagues;
