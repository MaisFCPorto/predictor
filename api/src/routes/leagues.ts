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
  const visibility = (String(body.visibility ?? 'private').toLowerCase() === 'public'
    ? 'public'
    : 'private') as 'public' | 'private';

  if (!userId) return jsonError(c, 400, 'Missing userId');
  if (!name) return jsonError(c, 400, 'Missing name');

  const id = crypto.randomUUID();

  // código curto para partilhar com amigos (6 chars)
  const code = (body.code as string | undefined)?.trim().toUpperCase()
    || id.replace(/-/g, '').toUpperCase().slice(0, 6);

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

export default leagues;
