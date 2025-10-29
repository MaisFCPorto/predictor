// apps/api/src/routes/rankings.ts
import { Hono } from 'hono';

type Env = { DB: D1Database };
export const rankings = new Hono<{ Bindings: Env }>();

// ---- Pontuação ----
const POINTS_EXACT  = 5;
const POINTS_DIFF   = 2; // <- o teu valor atual
const POINTS_WINNER = 1;

const sign = (d: number) => (d === 0 ? 0 : d > 0 ? 1 : -1);

// Calcula pontuação de UM palpite para um resultado real
function scoreOf(
  predHome: number | null | undefined,
  predAway: number | null | undefined,
  realHome: number | null | undefined,
  realAway: number | null | undefined,
) {
  if (realHome == null || realAway == null) {
    return { points: 0, exact: 0, diff: 0, winner: 0 };
  }
  if (predHome == null || predAway == null) {
    return { points: 0, exact: 0, diff: 0, winner: 0 };
  }

  const ph = Number(predHome);
  const pa = Number(predAway);
  const rh = Number(realHome);
  const ra = Number(realAway);

  if (ph === rh && pa === ra) {
    return { points: POINTS_EXACT, exact: 1, diff: 0, winner: 0 };
  }

  const pd = ph - pa;
  const rd = rh - ra;

  if (Math.abs(pd) === Math.abs(rd) && sign(pd) === sign(rd)) {
    return { points: POINTS_DIFF, exact: 0, diff: 1, winner: 0 };
  }

  if (sign(pd) === sign(rd)) {
    return { points: POINTS_WINNER, exact: 0, diff: 0, winner: 1 };
  }

  return { points: 0, exact: 0, diff: 0, winner: 0 };
}

// /api/rankings  (geral ou mensal se ?ym=YYYY-MM)
rankings.get('/', async (c) => {
  const ym = c.req.query('ym'); // ex: '2025-10'  -> modo mensal

  // 1) Fixtures FINISHED (opcionalmente filtrados por mês)
  const sqlFx = ym
    ? `
       SELECT id, home_score, away_score
       FROM fixtures
       WHERE status='FINISHED'
         AND strftime('%Y-%m', kickoff_at)=?
      `
    : `
       SELECT id, home_score, away_score
       FROM fixtures
       WHERE status='FINISHED'
      `;
  const finished = ym
    ? await c.env.DB.prepare(sqlFx).bind(ym).all<{ id: string; home_score: number; away_score: number }>()
    : await c.env.DB.prepare(sqlFx).all<{ id: string; home_score: number; away_score: number }>();

  const fin = finished.results ?? [];
  if (!fin.length) return c.json([], 200);

  // 2) Todas as previsões
  const preds = await c.env.DB
    .prepare(`SELECT user_id, fixture_id, home_goals, away_goals FROM predictions`)
    .all<{ user_id: string; fixture_id: string; home_goals: number; away_goals: number }>();

  // 3) Users (nome amigável)
  const users = await c.env.DB
    .prepare(`
      SELECT
        u.id,
        COALESCE(
          NULLIF(TRIM(u.name), ''),
          CASE
            WHEN u.email LIKE '%@%' THEN SUBSTR(u.email, 1, INSTR(u.email,'@')-1)
            ELSE u.email
          END,
          'Jogador'
        ) AS name,
        u.email,
        u.avatar_url
      FROM users u
    `)
    .all<{ id: string; name: string; email: string | null; avatar_url: string | null }>();

  const nameById = new Map(users.results?.map(u => [u.id, u.name]) ?? []);
  const avatarById = new Map(users.results?.map(u => [u.id, u.avatar_url ?? null]) ?? []);

  const fxMap = new Map(fin.map(f => [f.id, f]));
  type Acc = { user_id: string; name: string; avatar_url: string | null; points: number; exact: number; diff: number; winner: number };
  const score: Record<string, Acc> = {};

  for (const p of preds.results ?? []) {
    const f = fxMap.get(p.fixture_id);
    if (!f) continue; // só contas para jogos finalizados (e do mês se houver ym)

    const uName = nameById.get(p.user_id) ?? 'Jogador';
    if (!score[p.user_id]) {
      score[p.user_id] = {
        user_id: p.user_id,
        name: uName,
        avatar_url: avatarById.get(p.user_id) ?? null,
        points: 0, exact: 0, diff: 0, winner: 0,
      };
    }

    const s = scoreOf(p.home_goals, p.away_goals, f.home_score, f.away_score);
    score[p.user_id].points += s.points;
    score[p.user_id].exact  += s.exact;
    score[p.user_id].diff   += s.diff;
    score[p.user_id].winner += s.winner;
  }

  const ranking = Object.values(score).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.exact  !== a.exact)  return b.exact  - a.exact;
    return b.diff - a.diff;
  });

  return c.json(ranking, 200);
});

// /api/rankings/months  -> meses disponíveis com jogos FINISHED
rankings.get('/months', async (c) => {
  const { results } = await c.env.DB
    .prepare(`
      SELECT DISTINCT strftime('%Y-%m', kickoff_at) AS ym
      FROM fixtures
      WHERE status='FINISHED'
      ORDER BY ym DESC
    `)
    .all<{ ym: string }>();
  return c.json((results ?? []).map(r => r.ym), 200);
});

/* ======================================================
   NOVO: /api/rankings/games  (para o seletor "Por jogo")
   Devolve os jogos mais recentes com metadados básicos
====================================================== */
rankings.get('/games', async (c) => {
  const { results } = await c.env.DB
    .prepare(`
      SELECT
        f.id,
        f.kickoff_at,
        ht.name AS home_team_name,
        at.name AS away_team_name,
        co.code AS competition_code,
        f.round_label
      FROM fixtures f
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      LEFT JOIN competitions co ON co.id = f.competition_id
      ORDER BY f.kickoff_at DESC
      LIMIT 300
    `)
    .all<{
      id: string;
      kickoff_at: string;
      home_team_name: string;
      away_team_name: string;
      competition_code: string | null;
      round_label: string | null;
    }>();

  return c.json(results ?? [], 200);
});

/* ======================================================
   NOVO: /api/rankings/game?fixtureId=...
   Ranking por jogo. Lista TODOS os utilizadores, mesmo
   que não tenham palpite (0 pts).
====================================================== */
rankings.get('/game', async (c) => {
  const fixtureId = c.req.query('fixtureId');
  if (!fixtureId) return c.json({ error: 'missing_fixtureId' }, 400);

  // Resultado oficial (pode ainda não existir; nesse caso tudo dá 0)
  const fx = await c.env.DB
    .prepare(`
      SELECT id, status, home_score, away_score
      FROM fixtures
      WHERE id = ?
      LIMIT 1
    `)
    .bind(fixtureId)
    .first<{ id: string; status: string; home_score: number | null; away_score: number | null }>();

  if (!fx) return c.json({ error: 'fixture_not_found' }, 404);

  // Traz todos os users + o seu palpite (se existir) para esse jogo
  const { results } = await c.env.DB
    .prepare(`
      SELECT
        u.id                              AS user_id,
        COALESCE(
          NULLIF(TRIM(u.name), ''),
          CASE
            WHEN u.email LIKE '%@%' THEN SUBSTR(u.email, 1, INSTR(u.email,'@')-1)
            ELSE u.email
          END,
          'Jogador'
        )                                  AS name,
        u.avatar_url                       AS avatar_url,
        p.home_goals                       AS pred_home,
        p.away_goals                       AS pred_away
      FROM users u
      LEFT JOIN predictions p
        ON p.user_id = u.id AND p.fixture_id = ?
      ORDER BY name COLLATE NOCASE ASC
    `)
    .bind(fixtureId)
    .all<{
      user_id: string;
      name: string | null;
      avatar_url: string | null;
      pred_home: number | null;
      pred_away: number | null;
    }>();

  const rows = (results ?? []).map(r => {
    const s = scoreOf(r.pred_home, r.pred_away, fx.home_score, fx.away_score);
    return {
      user_id: r.user_id,
      name: r.name ?? 'Jogador',
      avatar_url: r.avatar_url,
      points: s.points,
      exact: s.exact,
      diff: s.diff,
      winner: s.winner,
    };
  });

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.exact  !== a.exact)  return b.exact  - a.exact;
    return b.diff - a.diff;
  });

  return c.json(rows, 200);
});
