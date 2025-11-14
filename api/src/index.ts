// predictor-porto/api/src/index.ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { rankings, scoreUEFA } from './routes/rankings';
import { adminCompetitions } from './routes/admin/competitions';
import { corsMiddleware } from './cors';
import { auth } from './routes/auth';
import { admin } from './routes/admin';

// ----------------------------------------------------
// Tipos / Bindings
// ----------------------------------------------------
type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
  LOCK_MINUTES_BEFORE?: string;
};

// ----------------------------------------------------
// App + CORS “à prova de bala”
// ----------------------------------------------------
const app = new Hono<{ Bindings: Env }>();

// CORS em TODAS as rotas
app.use('*', corsMiddleware);

app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['*'],
    exposeHeaders: ['Content-Length'],
    credentials: false,
    maxAge: 86400,
  }),
);

app.options('*', (c) => c.body(null, 204));

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------
function requireAdmin(c: Context<{ Bindings: Env }>): Response | undefined {
  const need = c.env.ADMIN_KEY;
  if (!need) return undefined; // em dev, sem chave, ignora

  const got = c.req.header('x-admin-key');
  if (!got || got !== need) return c.json({ error: 'forbidden' }, 403);
  return undefined;
}

const run = (db: D1Database, sql: string, ...args: unknown[]) =>
  db.prepare(sql).bind(...args).run();

const all = <T>(db: D1Database, sql: string, ...args: unknown[]) =>
  db.prepare(sql).bind(...args).all<T>();

const getLockMs = (c: Context<{ Bindings: Env }>) => {
  const mins = Number(c.env.LOCK_MINUTES_BEFORE ?? '0');
  return Number.isFinite(mins) ? mins * 60_000 : 0;
};

const isLocked = (kickoffISO: string, nowMs: number, lockMs: number) => {
  const ko = new Date(kickoffISO).getTime();
  return nowMs >= ko - lockMs;
};

// ----------------------------------------------------
// Helper: recalcular pontos UEFA para um fixture
// ----------------------------------------------------
async function recomputePointsForFixture(db: D1Database, fixtureId: string) {
  // 1) Buscar o resultado oficial do jogo
  const fx = await db
    .prepare(`
      SELECT home_score, away_score
      FROM fixtures
      WHERE id = ?
      LIMIT 1
    `)
    .bind(fixtureId)
    .first<{ home_score: number | null; away_score: number | null }>();

  // Se ainda não há resultado, não há pontos a recalcular
  if (!fx || fx.home_score == null || fx.away_score == null) {
    return;
  }

  // 2) Ir buscar todas as predictions desse jogo
  const { results } = await db
    .prepare(`
      SELECT user_id, fixture_id, home_goals, away_goals
      FROM predictions
      WHERE fixture_id = ?
    `)
    .bind(fixtureId)
    .all<{
      user_id: string;
      fixture_id: string;
      home_goals: number | null;
      away_goals: number | null;
    }>();

  // 3) Calcular pontos UEFA e gravar no campo "points"
  for (const p of results ?? []) {
    const s = scoreUEFA(p.home_goals, p.away_goals, fx.home_score, fx.away_score);

    await db
      .prepare(`
        UPDATE predictions
        SET points = ?
        WHERE user_id = ?
          AND fixture_id = ?
      `)
      .bind(s.points, p.user_id, p.fixture_id)
      .run();
  }
}

// ----------------------------------------------------
// Utilitários e Ctes
// ----------------------------------------------------
app.get('/health', (c) => c.text('ok'));
app.get('/routes', (c) =>
  c.json({
    ok: true,
    routes: [
      '/health',
      '/routes',
      '/api/matchdays/:id/fixtures',
      '/api/predictions',
      '/api/users/sync',
      '/api/admin/teams',
      '/api/admin/fixtures',
      '/api/admin/fixtures/porto',
    ],
  }),
);

// ----------------------------------------------------
// Rankings e Competitions
// ----------------------------------------------------
app.route('/api/rankings', rankings);
app.route('/api/admin/competitions', adminCompetitions);
app.route('/api/auth', auth);
app.route('/api/admin', admin);

// ----------------------------------------------------
// PUBLIC: Fixtures list
// ----------------------------------------------------
async function listFixtures(c: Context<{ Bindings: Env }>, matchdayId: string) {
  const lockMs = getLockMs(c);
  const now = Date.now();

  const { results } = await c.env.DB
    .prepare(
      `
      SELECT 
        f.id, f.kickoff_at, f.home_score, f.away_score, f.status,
        f.competition_id, f.round_label,
        f.leg AS leg,
        ht.name AS home_team_name, at.name AS away_team_name,
        ht.crest_url AS home_crest, at.crest_url AS away_crest,
        co.code AS competition_code, co.name AS competition_name
      FROM fixtures f
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      LEFT JOIN competitions co ON co.id = f.competition_id
      WHERE f.status = 'SCHEDULED'
      ORDER BY f.kickoff_at ASC
    `,
    )
    .all<{
      id: string;
      kickoff_at: string;
      status: string;
      home_team_name: string;
      away_team_name: string;
      home_crest: string | null;
      away_crest: string | null;
      competition_id: string | null;
      competition_code: string | null;
      competition_name: string | null;
      round_label: string | null;
      leg: number | null;
      home_score: number | null;
      away_score: number | null;
    }>();

  const lockMsLocal = lockMs;
  const enriched = (results ?? []).map((f) => {
    const koMs = new Date(f.kickoff_at).getTime();
    return {
      ...f,
      is_locked: isLocked(f.kickoff_at, now, lockMsLocal),
      lock_at_utc: new Date(koMs - lockMsLocal).toISOString(),
    };
  });

  return c.json(enriched);
}

app.get('/api/fixtures/open', async (c) => {
  const lockMs = getLockMs(c);
  const now = Date.now();

  const { results } = await c.env.DB
    .prepare(
      `
      SELECT 
        f.id, f.kickoff_at, f.home_score, f.away_score, f.status,
        f.competition_id, f.round_label,
        f.leg AS leg,
        ht.name AS home_team_name, at.name AS away_team_name,
        ht.crest_url AS home_crest, at.crest_url AS away_crest,
        co.code AS competition_code, co.name AS competition_name
      FROM fixtures f
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      LEFT JOIN competitions co ON co.id = f.competition_id
      WHERE f.status = 'SCHEDULED'
      ORDER BY f.kickoff_at ASC
    `,
    )
    .all<{
      id: string;
      kickoff_at: string;
      status: string;
      home_team_name: string;
      away_team_name: string;
      home_crest: string | null;
      away_crest: string | null;
      competition_id: string | null;
      competition_code: string | null;
      competition_name: string | null;
      round_label: string | null;
      leg: number | null;
      home_score: number | null;
      away_score: number | null;
    }>();

  const enriched = (results ?? []).map((f) => {
    const koMs = new Date(f.kickoff_at).getTime();
    return {
      ...f,
      is_locked: isLocked(f.kickoff_at, now, lockMs),
      lock_at_utc: new Date(koMs - lockMs).toISOString(),
    };
  });

  return c.json(enriched);
});

app.get('/api/matchdays/:id/fixtures', (c) =>
  listFixtures(c, c.req.param('id')),
);
app.get('/api/matchdays/md1/fixtures', (c) => listFixtures(c, 'md1'));

// ----------------------------------------------------
// PUBLIC: Finished fixtures with pagination
// ----------------------------------------------------
app.get('/api/fixtures/finished', async (c) => {
  const limitQ = Number(c.req.query('limit') ?? '10');
  const offsetQ = Number(c.req.query('offset') ?? '0');
  const limit = Number.isFinite(limitQ) ? Math.min(Math.max(limitQ, 1), 100) : 10;
  const offset = Number.isFinite(offsetQ) ? Math.max(offsetQ, 0) : 0;

  const { results } = await c.env.DB
    .prepare(
      `
      SELECT 
        f.id, f.kickoff_at, f.home_score, f.away_score, f.status,
        f.competition_id, f.round_label,
        f.leg AS leg,
        ht.name AS home_team_name, at.name AS away_team_name,
        ht.crest_url AS home_crest, at.crest_url AS away_crest,
        co.code AS competition_code, co.name AS competition_name
      FROM fixtures f
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      LEFT JOIN competitions co ON co.id = f.competition_id
      WHERE f.status = 'FINISHED'
      ORDER BY f.kickoff_at DESC
      LIMIT ? OFFSET ?
    `,
    )
    .bind(limit, offset)
    .all<{
      id: string;
      kickoff_at: string;
      status: string;
      home_team_name: string;
      away_team_name: string;
      home_crest: string | null;
      away_crest: string | null;
      competition_id: string | null;
      competition_code: string | null;
      competition_name: string | null;
      round_label: string | null;
      leg: number | null;
      home_score: number | null;
      away_score: number | null;
    }>();

  return c.json(results ?? []);
});

// ----------------------------------------------------
// PUBLIC: Closed fixtures (FINISHED or locked)
// ----------------------------------------------------
app.get('/api/fixtures/closed', async (c) => {
  const limitQ = Number(c.req.query('limit') ?? '10');
  const offsetQ = Number(c.req.query('offset') ?? '0');
  const limit = Number.isFinite(limitQ) ? Math.min(Math.max(limitQ, 1), 100) : 10;
  const offset = Number.isFinite(offsetQ) ? Math.max(offsetQ, 0) : 0;

  const lockMinutes = Number(c.env.LOCK_MINUTES_BEFORE ?? '0');
  const lockStr = String(Number.isFinite(lockMinutes) ? lockMinutes : 0);

  const { results } = await c.env.DB
    .prepare(
      `
      SELECT 
        f.id, f.kickoff_at, f.home_score, f.away_score, f.status,
        f.competition_id, f.round_label,
        f.leg AS leg,
        ht.name AS home_team_name, at.name AS away_team_name,
        ht.crest_url AS home_crest, at.crest_url AS away_crest,
        co.code AS competition_code, co.name AS competition_name
      FROM fixtures f
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      LEFT JOIN competitions co ON co.id = f.competition_id
      WHERE f.status = 'FINISHED'
         OR DATETIME('now') >= DATETIME(f.kickoff_at, '-' || ? || ' minutes')
      ORDER BY f.kickoff_at DESC
      LIMIT ? OFFSET ?
    `,
    )
    .bind(lockStr, limit, offset)
    .all<{
      id: string;
      kickoff_at: string;
      status: string;
      home_team_name: string;
      away_team_name: string;
      home_crest: string | null;
      away_crest: string | null;
      competition_id: string | null;
      competition_code: string | null;
      competition_name: string | null;
      round_label: string | null;
      leg: number | null;
      home_score: number | null;
      away_score: number | null;
    }>();

  return c.json(results ?? []);
});

// ----------------------------------------------------
// PUBLIC: Predictions
// ----------------------------------------------------
app.post('/api/predictions', async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ error: 'invalid_json' }, 400);

    const { fixtureId, home, away, userId } = body;
    if (!fixtureId || !userId || home == null || away == null) {
      return c.json({ error: 'missing_data' }, 400);
    }

    const userExists = await c.env.DB
      .prepare(`SELECT 1 FROM users WHERE id = ? LIMIT 1`)
      .bind(userId)
      .first();
    if (!userExists) return c.json({ error: 'user_missing' }, 400);

    const fx = await c.env.DB
      .prepare(
        `SELECT kickoff_at, status
         FROM fixtures
         WHERE id = ?
         LIMIT 1`,
      )
      .bind(fixtureId)
      .first<{ kickoff_at: string; status: string }>();

    if (!fx) return c.json({ error: 'fixture_not_found' }, 404);

    const lockMs = getLockMs(c);
    if (
      fx.status === 'FINISHED' ||
      isLocked(fx.kickoff_at, Date.now(), lockMs)
    ) {
      return c.json({ error: 'locked' }, 400);
    }

    await c.env.DB
      .prepare(
        `
        INSERT INTO predictions (id, user_id, fixture_id, home_goals, away_goals)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)
        ON CONFLICT(user_id, fixture_id)
        DO UPDATE SET
          home_goals = excluded.home_goals,
          away_goals = excluded.away_goals
      `,
      )
      .bind(userId, fixtureId, home, away)
      .run();

    return c.json({ success: true });
  } catch (e) {
    console.error('POST /api/predictions error:', e);
    return c.json({ error: 'internal_error' }, 500);
  }
});

app.get('/api/predictions', async (c) => {
  try {
    const userId = c.req.query('userId');
    if (!userId) {
      // devolve array vazio “normal” em JSON
      return c.json([], 200);
    }

    const { results } = await c.env.DB
      .prepare(
        `
        SELECT
          fixture_id,
          home_goals,
          away_goals,
          points
        FROM predictions
        WHERE user_id = ?
      `,
      )
      .bind(userId)
      .all<{
        fixture_id: string;
        home_goals: number | null;
        away_goals: number | null;
        points: number | null;
      }>();

    const safe = (results ?? []).map((r) => ({
      fixture_id: String(r.fixture_id),
      home_goals: r.home_goals ?? 0,
      away_goals: r.away_goals ?? 0,
      points: r.points, // pode ser null se ainda não foi calculado
    }));

    // Log server-side (apenas para debug; podes remover depois)
    console.log(
      'GET /api/predictions →',
      JSON.stringify(safe).slice(0, 200),
    );

    return c.json(safe, 200);
  } catch (e) {
    console.error('GET /api/predictions error:', e);
    return c.json({ error: 'internal_error' }, 500);
  }
});




// ----------------------------------------------------
// PUBLIC: Sync Users
// ----------------------------------------------------
app.post('/api/users/sync', async (c) => {
  try {
    const b = await c.req.json();
    if (!b?.id) return c.json({ error: 'missing_id' }, 400);

    await c.env.DB
      .prepare(
        `
      INSERT INTO users (id, email, name, avatar_url, role, created_at, updated_at, last_login)
      VALUES (?, ?, ?, ?, 'user', DATETIME('now'), DATETIME('now'), DATETIME('now'))
      ON CONFLICT(id) DO UPDATE SET
        email=COALESCE(excluded.email, users.email),
        name=COALESCE(excluded.name, users.name),
        avatar_url=COALESCE(excluded.avatar_url, users.avatar_url),
        updated_at=DATETIME('now'),
        last_login=DATETIME('now')
    `,
      )
      .bind(b.id, b.email ?? null, b.name ?? null, b.avatar_url ?? null)
      .run();

    return c.json({ ok: true });
  } catch (e) {
    console.error('Erro /api/users/sync:', e);
    return c.json({ error: 'sync_failed' }, 500);
  }
});

// ----------------------------------------------------
// ADMIN: Teams
// ----------------------------------------------------
app.get('/api/admin/teams', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;
  const { results } = await all<any>(c.env.DB, `SELECT id, name FROM teams ORDER BY name`);
  return c.json(results);
});

// --- ADMIN: check -------------------------------------------------
app.get('/api/admin/check', (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard; // devolve 403 se a x-admin-key não bater certo
  return c.json({ ok: true });
});

// ----------------------------------------------------
// ADMIN: Fixtures (NOVO modelo sem matchday_id obrigatório)
// ----------------------------------------------------
app.get('/api/admin/fixtures', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;
  const { results } = await c.env.DB
    .prepare(
      `
      SELECT f.*, ht.name AS home_name, at.name AS away_name,
             co.code AS competition_code
      FROM fixtures f
      JOIN teams ht ON ht.id=f.home_team_id
      JOIN teams at ON at.id=f.away_team_id
      LEFT JOIN competitions co ON co.id=f.competition_id
      ORDER BY f.kickoff_at DESC
    `,
    )
    .all();
  return c.json(results ?? []);
});

app.post('/api/admin/fixtures', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;

  try {
    const b = await c.req.json();

    const genId = () =>
      'g' +
      crypto
        .getRandomValues(new Uint8Array(3))
        .reduce((s, n) => s + n.toString(16).padStart(2, '0'), '');

    const id = (b.id && String(b.id)) || genId();

    // valida mínimos
    if (!b.home_team_id || !b.away_team_id)
      return c.json({ error: 'missing_team' }, 400);
    if (b.home_team_id === b.away_team_id)
      return c.json({ error: 'same_team' }, 400);
    if (!b.kickoff_at) return c.json({ error: 'missing_kickoff' }, 400);

    // campos opcionais
    const competition_id = b.competition_id ?? null;
    const round_label = b.round_label ?? null;

    // usar 'leg_number' como coluna canónica
    const leg = (b.leg_number ?? b.leg) ?? null;

    // se ainda tens a coluna matchday_id e queres um default:
    const matchday_id = b.matchday_id ?? 'md1';

    await run(
      c.env.DB,
      `INSERT INTO fixtures (
         id, matchday_id,
         competition_id, round_label, leg,
         home_team_id, away_team_id,
         kickoff_at, status
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'SCHEDULED'))`,
      id,
      matchday_id,
      competition_id,
      round_label,
      leg,
      b.home_team_id,
      b.away_team_id,
      b.kickoff_at,
      b.status ?? null,
    );

    return c.json({ ok: true, id });
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('POST /api/admin/fixtures failed:', msg);
    return c.json({ error: 'create_failed', detail: msg }, 500);
  }
});

app.patch('/api/admin/fixtures/:id', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;
  const id = c.req.param('id');
  const b = await c.req.json();

  const touchesScore = 'home_score' in b || 'away_score' in b;

  await run(
    c.env.DB,
    `UPDATE fixtures SET
       home_team_id   = COALESCE(?, home_team_id),
       away_team_id   = COALESCE(?, away_team_id),
       kickoff_at     = COALESCE(?, kickoff_at),
       status         = COALESCE(?, status),
       competition_id = COALESCE(?, competition_id),
       round_label    = COALESCE(?, round_label),
       leg            = COALESCE(?, leg),
       home_score     = COALESCE(?, home_score),
       away_score     = COALESCE(?, away_score)
     WHERE id=?`,
    b.home_team_id ?? null,
    b.away_team_id ?? null,
    b.kickoff_at ?? null,
    b.status ?? null,
    b.competition_id ?? null,
    b.round_label ?? null,
    (b.leg_number ?? b.leg ?? null),
    b.home_score ?? null,
    b.away_score ?? null,
    id,
  );

  if (touchesScore) {
    await recomputePointsForFixture(c.env.DB, id);
  }

  return c.json({ ok: true });
});

app.delete('/api/admin/fixtures/:id', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;
  const id = c.req.param('id');
  await run(c.env.DB, `DELETE FROM predictions WHERE fixture_id=?`, id);
  await run(c.env.DB, `DELETE FROM fixtures WHERE id=?`, id);
  return c.json({ ok: true });
});

app.patch('/api/admin/fixtures/:id/result', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;
  const id = c.req.param('id');
  const { home_score, away_score } = await c.req.json();

  await run(
    c.env.DB,
    `UPDATE fixtures SET home_score=?, away_score=?, status='FINISHED' WHERE id=?`,
    Number(home_score),
    Number(away_score),
    id,
  );

  await recomputePointsForFixture(c.env.DB, id);

  return c.json({ ok: true });
});

app.patch('/api/admin/fixtures/:id/reopen', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;
  const id = c.req.param('id');
  await run(
    c.env.DB,
    `UPDATE fixtures SET home_score=NULL, away_score=NULL, status='SCHEDULED' WHERE id=?`,
    id,
  );
  return c.json({ ok: true });
});

// GET /api/users/:id/role
app.get('/api/users/:id/role', async (c) => {
  const userId = c.req.param('id');
  if (!userId) return c.json({ role: null }, 400);

  const row = await c.env.DB
    .prepare(`SELECT role FROM users WHERE id = ? LIMIT 1`)
    .bind(userId)
    .first<{ role: string | null }>();

  return c.json({ role: row?.role ?? null });
});

app.get('/api/users/role/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing_user' }, 400);

  const row = await c.env.DB
    .prepare(`SELECT role FROM users WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<{ role: string | null }>();

  return c.json({ role: row?.role ?? 'user' });
});

// ----------------------------------------------------
// Exporta App
// ----------------------------------------------------
export default app;
