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

/**
 * GET /api/leagues?userId=...
 *
 * Lista as ligas em que o utilizador participa.
 */
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

/**
 * POST /api/leagues
 *
 * Body: { userId: string, name: string, visibility?: 'public' | 'private' }
 *
 * Cria uma nova liga e adiciona o owner como membro.
 */
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

  // Código curto para partilhar com amigos (6 chars)
  const code =
    (body.code as string | undefined)?.trim().toUpperCase() ||
    id.replace(/-/g, '').toUpperCase().slice(0, 6);

  // Inserir liga + membership numa batch
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

/**
 * POST /api/leagues/join
 *
 * Body: { userId: string, code: string }
 *
 * Junta-se a uma liga existente pelo código.
 */
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

  // Inserir membership se ainda não existir
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

/**
 * GET /api/leagues/:leagueId
 *
 * Detalhe da liga (info + membros + role do utilizador atual).
 */
leagues.get('/leagues/:leagueId', async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param('leagueId');
  const userId = c.req.query('userId');

  if (!userId) return jsonError(c, 400, 'Missing userId');

  const league = await db
    .prepare(
      `SELECT id, owner_id, name, code, visibility
       FROM leagues
       WHERE id = ?`,
    )
    .bind(leagueId)
    .first<{
      id: string;
      owner_id: string;
      name: string;
      code: string;
      visibility: string;
    }>();

  if (!league) return jsonError(c, 404, 'Liga não encontrada');

  const membersRes = await db
    .prepare(
      `SELECT lm.user_id, lm.role, u.name
       FROM league_members lm
       LEFT JOIN users u ON u.id = lm.user_id
       WHERE lm.league_id = ?
       ORDER BY u.name ASC`,
    )
    .bind(leagueId)
    .all<{ user_id: string; role: string; name: string | null }>();

  const members = membersRes.results ?? [];

  const currentMember = members.find((m) => m.user_id === userId);
  const currentUserRole =
    league.owner_id === userId ? 'owner' : currentMember?.role ?? null;

  return c.json({
    league,
    members,
    currentUserRole,
  });
});

/**
 * PATCH /api/leagues/:leagueId
 *
 * Atualiza nome e/ou visibilidade da liga (apenas owner).
 */
leagues.patch('/leagues/:leagueId', async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param('leagueId');

  const body = (await c.req.json().catch(() => null)) as
    | { userId?: string; name?: string; visibility?: string }
    | null;

  if (!body?.userId) return jsonError(c, 400, 'Missing userId');

  const league = await db
    .prepare('SELECT owner_id FROM leagues WHERE id = ?')
    .bind(leagueId)
    .first<{ owner_id: string }>();

  if (!league) return jsonError(c, 404, 'Liga não encontrada');
  if (league.owner_id !== body.userId) {
    return jsonError(c, 403, 'Apenas o owner pode editar a liga');
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (body.name && body.name.trim()) {
    updates.push('name = ?');
    params.push(body.name.trim());
  }

  if (
    body.visibility &&
    (body.visibility === 'public' || body.visibility === 'private')
  ) {
    updates.push('visibility = ?');
    params.push(body.visibility);
  }

  if (updates.length === 0) {
    return c.json({ ok: true }); // nada para atualizar
  }

  params.push(leagueId);

  await db
    .prepare(`UPDATE leagues SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  return c.json({ ok: true });
});

/**
 * DELETE /api/leagues/:leagueId
 *
 * Apaga a liga (apenas owner).
 */
leagues.delete('/leagues/:leagueId', async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param('leagueId');

  const body = (await c.req.json().catch(() => null)) as
    | { userId?: string }
    | null;

  if (!body?.userId) return jsonError(c, 400, 'Missing userId');

  const league = await db
    .prepare('SELECT owner_id FROM leagues WHERE id = ?')
    .bind(leagueId)
    .first<{ owner_id: string }>();

  if (!league) return jsonError(c, 404, 'Liga não encontrada');
  if (league.owner_id !== body.userId) {
    return jsonError(c, 403, 'Apenas o owner pode apagar a liga');
  }

  await db.batch([
    db
      .prepare('DELETE FROM league_members WHERE league_id = ?')
      .bind(leagueId),
    db.prepare('DELETE FROM leagues WHERE id = ?').bind(leagueId),
  ]);

  return c.json({ ok: true });
});

/**
 * DELETE /api/leagues/:leagueId/members/:memberUserId
 *
 * Remove um membro da liga (apenas owner).
 */
leagues.delete('/leagues/:leagueId/members/:memberUserId', async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param('leagueId');
  const memberUserId = c.req.param('memberUserId');

  const body = (await c.req.json().catch(() => null)) as
    | { userId?: string }
    | null;

  if (!body?.userId) return jsonError(c, 400, 'Missing userId');

  const league = await db
    .prepare('SELECT owner_id FROM leagues WHERE id = ?')
    .bind(leagueId)
    .first<{ owner_id: string }>();

  if (!league) return jsonError(c, 404, 'Liga não encontrada');
  if (league.owner_id !== body.userId) {
    return jsonError(c, 403, 'Apenas o owner pode gerir membros');
  }

  if (memberUserId === league.owner_id) {
    return jsonError(c, 400, 'Não podes remover o owner da liga');
  }

  await db
    .prepare(
      'DELETE FROM league_members WHERE league_id = ? AND user_id = ?',
    )
    .bind(leagueId, memberUserId)
    .run();

  return c.json({ ok: true });
});

/**
 * GET /api/leagues/:leagueId/ranking
 *
 * Ranking geral da liga (soma de todos os pontos dos jogos).
 */
leagues.get('/leagues/:leagueId/ranking', async (c) => {
  const db = c.env.DB;
  const leagueId = c.req.param('leagueId');

  // 1) info da liga
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

  // 2) ranking da liga: pontos totais de todos os jogos
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

  // 3) aplicar posição (1, 2, 3, …)
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
