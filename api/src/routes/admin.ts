// predictor-porto/api/src/routes/admin.ts
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { scoreUEFA } from './rankings';

const SCORER_BONUS_BY_POS: Record<string, number> = {
  GR: 10,
  D: 5,
  M: 3,
  A: 1,
};

function scorerBonusForPosition(pos: string | null | undefined): number {
  if (!pos) return 0;
  const key = pos.toUpperCase();
  return SCORER_BONUS_BY_POS[key] ?? 0;
}

type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
  FOOTBALL_DATA_TOKEN: string;
};

// 🔥 Exportar para usar noutros ficheiros (index.ts)
export async function recomputePointsForFixture(DB: D1Database, fixtureId: string) {
  // 1) Obter o resultado oficial do jogo
  const fx = await DB.prepare(
    `
      SELECT id, home_score, away_score
      FROM fixtures
      WHERE id = ?
      LIMIT 1
    `,
  )
    .bind(fixtureId)
    .first<{ id: string; home_score: number | null; away_score: number | null }>();

  if (!fx || fx.home_score == null || fx.away_score == null) {
    return;
  }

  // 2) Buscar marcadores reais desse jogo + posição
  const { results: scorerRows } = await DB.prepare(
    `
      SELECT fs.player_id, p.position
      FROM fixture_scorers fs
      LEFT JOIN players p ON p.id = fs.player_id
      WHERE fs.fixture_id = ?
    `,
  )
    .bind(fixtureId)
    .all<{ player_id: string; position: string | null }>();

  const bonusByPlayer = new Map<string, number>();
  for (const r of scorerRows ?? []) {
    const bonus = scorerBonusForPosition(r.position);
    if (bonus) {
      bonusByPlayer.set(String(r.player_id), bonus);
    }
  }

  // 3) Ir buscar as predictions desse jogo (inclui scorer_player_id)
  const { results } = await DB.prepare(
    `
      SELECT
        user_id,
        fixture_id,
        home_goals,
        away_goals,
        scorer_player_id,
        points
      FROM predictions
      WHERE fixture_id = ?
    `,
  )
    .bind(fixtureId)
    .all<{
      user_id: string;
      fixture_id: string;
      home_goals: number | null;
      away_goals: number | null;
      scorer_player_id: string | number | null;
      points: number | null;
    }>();

  // 4) Calcular pontos UEFA + bónus marcador e gravar em points
  for (const p of results ?? []) {
    const s = scoreUEFA(p.home_goals, p.away_goals, fx.home_score, fx.away_score);

    let pts = s.points;

    if (p.scorer_player_id != null) {
      const key = String(p.scorer_player_id);
      const bonus = bonusByPlayer.get(key) ?? 0;
      pts += bonus;
    }

    await DB.prepare(
      `
        UPDATE predictions
        SET points = ?
        WHERE user_id = ?
          AND fixture_id = ?
      `,
    )
      .bind(pts, p.user_id, p.fixture_id)
      .run();
  }
}


// Middleware: exige header x-admin-key (chave guardada no Worker)
const requireAdminKey: import('hono').MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const key = c.req.header('x-admin-key');
  if (!key || key !== c.env.ADMIN_KEY) return c.json({ error: 'forbidden' }, 403);
  await next();
};

// Exporta um router Hono (não a app global)
export const admin = new Hono<{ Bindings: Env }>();

admin.get('/health', (c) => c.json({ ok: true }));

admin.get('/role', requireAdminKey, async (c) => {
  const email = c.req.query('email');
  if (!email) return c.json({ error: 'email required' }, 400);

  const row = await c.env.DB
    .prepare('SELECT role FROM users WHERE email = ?')
    .bind(email)
    .first<{ role: string }>();

  return c.json({ role: row?.role ?? 'user' });
});

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
  const token = (c.env.FOOTBALL_DATA_TOKEN || '').trim();
  if (!token) return c.json({ error: 'missing token' }, 500);

  const url = 'https://api.football-data.org/v4/teams/503/matches?status=SCHEDULED';
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Auth-Token': token,
      accept: 'application/json',
    },
    redirect: 'manual',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    const status =
      res.status === 204 || res.status === 205 || res.status === 304 ? 500 : res.status;
    return c.json(
      { error: 'upstream', status: res.status, body },
      status as ContentfulStatusCode,
    );
  }

  const data = await res.json();
  return c.json(data);
});
