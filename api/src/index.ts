// predictor-porto/api/src/index.ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import { rankings, scoreUEFA } from './routes/rankings';
import { adminCompetitions } from './routes/admin/competitions';
import { adminPlayers } from './routes/admin/players';
import { adminFixtureScorers } from './routes/admin/fixture-scorers';
import { adminTeams } from './routes/admin/teams';
import { corsMiddleware } from './cors';
import { auth } from './routes/auth';
import { admin, recomputePointsForFixture } from './routes/admin';
import { adminPredictions } from './routes/admin/predictions';

// ----------------------------------------------------
// Tipos / Bindings
// ----------------------------------------------------
type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
  LOCK_MINUTES_BEFORE?: string;
  SUPABASE_URL: string;
};

// ----------------------------------------------------
// App + CORS
// ----------------------------------------------------
const app = new Hono<{ Bindings: Env }>();

// CORS em TODAS as rotas (o middleware trata também dos OPTIONS)
app.use('*', corsMiddleware);

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
      '/api/admin/competitions',
      '/api/admin/players',
      '/api/admin/predictions',
    ],
  }),
);

// ----------------------------------------------------
// Rankings e Competitions
// ----------------------------------------------------
app.route('/api/rankings', rankings);
app.route('/api/admin/competitions', adminCompetitions);
app.route('/api/admin/players', adminPlayers);
app.route('/api/admin/fixtures', adminFixtureScorers);
app.route('/api/auth', auth);
app.route('/api/admin', admin);
app.route('/api/admin/teams', adminTeams);
app.route('/api/admin/predictions', adminPredictions);


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
//  -- COM marcadores reais (scorers_names)
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
        f.id,
        f.kickoff_at,
        f.home_score,
        f.away_score,
        f.status,
        f.competition_id,
        f.round_label,
        f.leg AS leg,
        ht.name       AS home_team_name,
        at.name       AS away_team_name,
        ht.crest_url  AS home_crest,
        at.crest_url  AS away_crest,
        co.code       AS competition_code,
        co.name       AS competition_name,
        GROUP_CONCAT(p.name, ',') AS scorers_names
      FROM fixtures f
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      LEFT JOIN competitions    co ON co.id = f.competition_id
      LEFT JOIN fixture_scorers fs ON fs.fixture_id = f.id
      LEFT JOIN players         p  ON p.id = fs.player_id
      WHERE f.status = 'FINISHED'
         OR DATETIME('now') >= DATETIME(f.kickoff_at, '-' || ? || ' minutes')
      GROUP BY f.id
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
      scorers_names: string | null;
    }>();

  const rows = results ?? [];

  const enriched = rows.map((r) => ({
    ...r,
    scorers_names: r.scorers_names
      ? r.scorers_names
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  }));

  return c.json(enriched);
});

// ----------------------------------------------------
// PUBLIC: Predictions
// ----------------------------------------------------
app.post('/api/predictions', async (c) => {
  try {
    const body = (await c.req.json().catch(() => null)) as
      | {
          fixtureId?: string;
          home?: number;
          away?: number;
          userId?: string;
          scorer_player_id?: string | number | null;
        }
      | null;

    if (!body) return c.json({ error: 'invalid_json' }, 400);

    const { fixtureId, home, away, userId, scorer_player_id } = body;

    if (!fixtureId || !userId || home == null || away == null) {
      return c.json({ error: 'missing_data' }, 400);
    }

    let scorerId: string | null = null;
    if (typeof scorer_player_id === 'string') {
      const t = scorer_player_id.trim();
      scorerId = t || null;
    } else if (
      typeof scorer_player_id === 'number' &&
      Number.isFinite(scorer_player_id)
    ) {
      scorerId = String(scorer_player_id);
    }

    console.log('POST /api/predictions payload', {
      fixtureId,
      home,
      away,
      userId,
      scorerId,
    });

    const db = c.env.DB;

    const userExists = await db
      .prepare(`SELECT 1 FROM users WHERE id = ? LIMIT 1`)
      .bind(userId)
      .first();
    if (!userExists) return c.json({ error: 'user_missing' }, 400);

    const fx = await db
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

    const updateRes = await db
      .prepare(
        `
        UPDATE predictions
        SET home_goals = ?, away_goals = ?, scorer_player_id = ?
        WHERE user_id = ? AND fixture_id = ?
      `,
      )
      .bind(home, away, scorerId, userId, fixtureId)
      .run();

    console.log('POST /api/predictions UPDATE meta', updateRes.meta);

    let mode: 'update' | 'insert' = 'update';

    if (!updateRes.meta?.changes) {
      const insertRes = await db
        .prepare(
          `
          INSERT INTO predictions (
            id,
            user_id,
            fixture_id,
            home_goals,
            away_goals,
            scorer_player_id,
            created_at
          )
          VALUES (
            lower(hex(randomblob(16))),
            ?, ?, ?, ?, ?, DATETIME('now')
          )
        `,
        )
        .bind(userId, fixtureId, home, away, scorerId)
        .run();

      console.log('POST /api/predictions INSERT meta', insertRes.meta);
      mode = 'insert';
    }

    return c.json({ success: true, mode });
  } catch (e: any) {
    console.error('POST /api/predictions ERROR', e?.message, e?.stack);
    return c.json({ error: 'internal_error', detail: String(e) }, 500);
  }
});

app.get('/api/predictions', async (c) => {
  try {
    const userId = c.req.query('userId');
    if (!userId) {
      return c.json([], 200);
    }

    const { results } = await c.env.DB
      .prepare(
        `
        SELECT
          fixture_id,
          home_goals,
          away_goals,
          points,
          scorer_player_id
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
        scorer_player_id: string | null;
      }>();

    const safe = (results ?? []).map((r) => ({
      fixture_id: String(r.fixture_id),
      home_goals: r.home_goals ?? 0,
      away_goals: r.away_goals ?? 0,
      points: r.points,
      scorer_player_id: r.scorer_player_id ?? null,
      scorerPlayerId: r.scorer_player_id ?? null,
    }));

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
// PUBLIC: Players (ex: plantel FC Porto)
// ----------------------------------------------------
app.get('/api/players', async (c) => {
  const { results } = await c.env.DB
    .prepare(
      `
      SELECT id, team_id, name, position
      FROM players
      WHERE is_active = 1
      ORDER BY
        CASE position
          WHEN 'GR' THEN 1
          WHEN 'D'  THEN 2
          WHEN 'M'  THEN 3
          WHEN 'A'  THEN 4
          ELSE 5
        END,
        name
    `,
    )
    .all<{
      id: string;
      team_id: string;
      name: string;
      position: string;
    }>();

  return c.json(results ?? []);
});

// ----------------------------------------------------
// ADMIN: Teams
// ----------------------------------------------------
app.get('/api/admin/teams', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;

  const { results } = await all<{
    id: string;
    name: string;
    short_name: string | null;
    crest_url: string | null;
  }>(
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

// Criar equipa
app.post('/api/admin/teams', async (c) => {
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

// Atualizar equipa
app.patch('/api/admin/teams/:id', async (c) => {
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

// Apagar equipa (+ fixtures associadas)
app.delete('/api/admin/teams/:id', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;

  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing_id' }, 400);

  // Apagar fixtures onde esta equipa participa
  await run(
    c.env.DB,
    `
    DELETE FROM fixtures
    WHERE home_team_id = ? OR away_team_id = ?
    `,
    id,
    id,
  );

  // Apagar a própria equipa
  await run(c.env.DB, `DELETE FROM teams WHERE id = ?`, id);

  return c.json({ ok: true });
});

// --- ADMIN: check -------------------------------------------------
app.get('/api/admin/check', (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;
  return c.json({ ok: true });
});

// ----------------------------------------------------
// ADMIN: Fixtures (modelo sem matchday_id obrigatório)
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

    if (!b.home_team_id || !b.away_team_id)
      return c.json({ error: 'missing_team' }, 400);
    if (b.home_team_id === b.away_team_id)
      return c.json({ error: 'same_team' }, 400);
    if (!b.kickoff_at) return c.json({ error: 'missing_kickoff' }, 400);

    const competition_id = b.competition_id ?? null;
    const round_label = b.round_label ?? null;
    const leg = b.leg_number ?? b.leg ?? null;
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
    b.leg_number ?? b.leg ?? null,
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

// ----------------------------------------------------
// ADMIN: Fixture scorers (golos FC Porto)
// ----------------------------------------------------
app.get('/api/admin/fixtures/:id/scorers', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;

  const fixtureId = c.req.param('id');

  const { results } = await c.env.DB
    .prepare(
      `
      SELECT 
        fs.player_id,
        p.name,
        p.position
      FROM fixture_scorers fs
      LEFT JOIN players p ON p.id = fs.player_id
      WHERE fs.fixture_id = ?
      ORDER BY 
        CASE p.position
          WHEN 'GR' THEN 1
          WHEN 'D'  THEN 2
          WHEN 'M'  THEN 3
          WHEN 'A'  THEN 4
          ELSE 5
        END,
        p.name
    `,
    )
    .bind(fixtureId)
    .all<{
      player_id: string;
      name: string | null;
      position: string | null;
    }>();

  return c.json(results ?? []);
});

app.put('/api/admin/fixtures/:id/scorers', async (c) => {
  const guard = requireAdmin(c);
  if (guard) return guard;

  const fixtureId = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as
    | { player_ids?: string[] }
    | null;

  const ids = Array.isArray(body?.player_ids)
    ? body!.player_ids.map((x) => String(x)).filter(Boolean)
    : [];

  await run(c.env.DB, `DELETE FROM fixture_scorers WHERE fixture_id = ?`, fixtureId);

  for (const pid of ids) {
    await run(
      c.env.DB,
      `
      INSERT INTO fixture_scorers (id, fixture_id, player_id, created_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, DATETIME('now'))
    `,
      fixtureId,
      pid,
    );
  }

  await recomputePointsForFixture(c.env.DB, fixtureId);

  return c.json({ ok: true, count: ids.length });
});

// ----------------------------------------------------
// USERS: Roles
// ----------------------------------------------------
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
// USERS: Last points (resumo do último jogo pontuado)
// ----------------------------------------------------
app.get('/api/users/:id/last-points', async (c) => {
  const userId = c.req.param('id');
  if (!userId) return c.json(null, 400);

  const db = c.env.DB;

  const last = await db
    .prepare(
      `
      SELECT 
        p.fixture_id,
        f.kickoff_at,
        f.home_score,
        f.away_score
      FROM predictions p
      JOIN fixtures f ON f.id = p.fixture_id
      WHERE 
        p.user_id = ?
        AND f.status = 'FINISHED'
        AND f.home_score IS NOT NULL
        AND f.away_score IS NOT NULL
      ORDER BY f.kickoff_at DESC
      LIMIT 1
    `,
    )
    .bind(userId)
    .first<{
      fixture_id: string;
      kickoff_at: string;
      home_score: number;
      away_score: number;
    }>();

  if (!last) {
    return c.json(null);
  }

  const { fixture_id, kickoff_at, home_score, away_score } = last;

  const { results } = await db
    .prepare(
      `
      SELECT user_id, home_goals, away_goals, points
      FROM predictions
      WHERE fixture_id = ?
    `,
    )
    .bind(fixture_id)
    .all<{
      user_id: string;
      home_goals: number | null;
      away_goals: number | null;
      points: number | null;
    }>();

  type Row = {
    user_id: string;
    points: number;
    exact: number;
    diff: number;
    winner: number;
  };

  const table: Row[] = (results ?? []).map((r) => {
    const s = scoreUEFA(
      r.home_goals ?? 0,
      r.away_goals ?? 0,
      home_score,
      away_score,
    );
    const pts = typeof r.points === 'number' ? r.points : s.points;

    return {
      user_id: r.user_id,
      points: pts,
      exact: s.exact ?? 0,
      diff: s.diff ?? 0,
      winner: s.winner ?? 0,
    };
  });

  table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return 0;
  });

  const idx = table.findIndex((r) => r.user_id === userId);
  const me = idx >= 0 ? table[idx] : null;

  if (!me) {
    return c.json(null);
  }

  const payload = {
    points: me.points,
    exact: me.exact,
    diff: me.diff,
    winner: me.winner,
    position: idx + 1,
    fixture: {
      id: fixture_id,
      kickoff_at,
    },
  };

  return c.json(payload);
});

// ----------------------------------------------------
// Exporta App
// ----------------------------------------------------
export default app;
