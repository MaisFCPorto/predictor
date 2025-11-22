// predictor-porto/api/src/routes/admin.ts
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { scoreUEFA } from './rankings';

// ---------------- Pontos extra por posição ----------------
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

// ---------------- Env bindings ----------------
export type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
  FOOTBALL_DATA_TOKEN: string;
};

// ---------------- Recompute pontos por jogo ----------------
export async function recomputePointsForFixture(
  DB: D1Database,
  fixtureId: string,
) {
  const db = DB;

  // 1) Obter o resultado oficial do jogo
  const fx = await db
    .prepare(
      `
      SELECT id, home_score, away_score
      FROM fixtures
      WHERE id = ?
      LIMIT 1
    `,
    )
    .bind(fixtureId)
    .first<{ id: string; home_score: number | null; away_score: number | null }>();

  // Se não houver resultado, limpamos os pontos (para não ficar lixo antigo)
  if (!fx || fx.home_score == null || fx.away_score == null) {
    await db
      .prepare(
        `
        UPDATE predictions
        SET points = NULL
        WHERE fixture_id = ?
      `,
      )
      .bind(fixtureId)
      .run();
    return;
  }

  const { home_score, away_score } = fx;

  // 2) Buscar marcadores reais desse jogo + posição
  const { results: scorerRows } = await db
    .prepare(
      `
      SELECT fs.player_id, p.position
      FROM fixture_scorers fs
      LEFT JOIN players p ON p.id = fs.player_id
      WHERE fs.fixture_id = ?
    `,
    )
    .bind(fixtureId)
    .all<{ player_id: string; position: string | null }>();

  // Mapa player_id -> bónus por posição
  const bonusByPlayer = new Map<string, number>();
  for (const r of scorerRows ?? []) {
    const bonus = scorerBonusForPosition(r.position);
    if (bonus) {
      bonusByPlayer.set(String(r.player_id), bonus);
    }
  }

  // 3) Ir buscar as predictions desse jogo (inclui scorer_player_id)
  const { results: preds } = await db
    .prepare(
      `
      SELECT
        id,
        user_id,
        fixture_id,
        home_goals,
        away_goals,
        scorer_player_id
      FROM predictions
      WHERE fixture_id = ?
    `,
    )
    .bind(fixtureId)
    .all<{
      id: string;
      user_id: string;
      fixture_id: string;
      home_goals: number | null;
      away_goals: number | null;
      scorer_player_id: string | number | null;
    }>();

  // 4) Calcular pontos UEFA + bónus marcador e gravar em points
  for (const p of preds ?? []) {
    // Pontos base (tendência + golos casa + golos fora + diferença)
    const s = scoreUEFA(
      p.home_goals,
      p.away_goals,
      home_score,
      away_score,
    );

    let pts = s.points;

    // Bónus por marcador acertado (se o jogador previsto tiver marcado)
    if (p.scorer_player_id != null) {
      const key = String(p.scorer_player_id);
      const bonus = bonusByPlayer.get(key) ?? 0;
      pts += bonus;
    }

    await db
      .prepare(
        `
        UPDATE predictions
        SET points = ?
        WHERE id = ?
      `,
      )
      .bind(pts, p.id)
      .run();
  }
}

// ---------------- Middleware admin ----------------

// Este middleware aceita SEM chave se o pedido vier do teu site
// (maispredictor.app ou localhost:3000), mas exige x-admin-key
// para pedidos diretos.
export const requireAdminKey: import('hono').MiddlewareHandler<{
  Bindings: Env;
}> = async (c, next) => {
  const key = c.req.header('x-admin-key')?.trim() || '';
  const origin = c.req.header('origin') || '';

  const trustedOrigin =
    origin.startsWith('https://maispredictor.app') ||
    origin.startsWith('http://localhost:3000');

  // Se não vier de origem "de confiança", obriga à admin key
  if (!trustedOrigin && (!key || key !== c.env.ADMIN_KEY)) {
    return c.json({ error: 'forbidden' }, 403);
  }

  await next();
};

// ---------------- Router admin ----------------

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

admin.get('/teams', requireAdminKey, async (c) => {
  const { results } = await c.env.DB
    .prepare(`
      SELECT id, name, short_name, crest_url
      FROM teams
      ORDER BY name
    `)
    .all();
  return c.json(results);
});

// --- Lista de competições
admin.get('/competitions', requireAdminKey, async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT id, code, name FROM competitions ORDER BY name')
    .all();
  return c.json(results);
});

// --- Próximos jogos do FCP (Football-Data.org)
admin.get('/fixtures/porto', requireAdminKey, async (c) => {
  const token = (c.env.FOOTBALL_DATA_TOKEN || '').trim();
  if (!token) return c.json({ error: 'missing token' }, 500);

  const url =
    'https://api.football-data.org/v4/teams/503/matches?status=SCHEDULED';

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
      res.status === 204 || res.status === 205 || res.status === 304
        ? 500
        : res.status;
    return c.json(
      { error: 'upstream', status: res.status, body },
      status as ContentfulStatusCode,
    );
  }

  const data = await res.json();
  return c.json(data);
});
