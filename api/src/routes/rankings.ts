// apps/api/src/routes/rankings.ts
import { Hono } from 'hono';

type Env = { DB: D1Database };
export const rankings = new Hono<{ Bindings: Env }>();

/* ============================
   Pontuação estilo UEFA
============================ */
// - vencedor/empate correto:            +3 pts
// - golos da equipa da casa corretos:   +2 pts
// - golos da equipa de fora corretos:   +2 pts
// - diferença de golos correta:         +3 pts

const P_WINNER = 3;
const P_HOME_GOALS = 2;
const P_AWAY_GOALS = 2;
const P_DIFF = 3;

const sign = (d: number) => (d === 0 ? 0 : d > 0 ? 1 : -1);

type ScoreUEFAResult = {
  points: number;
  exact: number;   // resultado exato (ambos os golos certos)
  diff: number;    // diferença correta mas não exata
  winner: number;  // apenas tendência correta (sem diff nem exato)
};

// Calcula pontuação de UM palpite para um resultado real (modelo UEFA)
export function scoreUEFA(
  predHome: number | null | undefined,
  predAway: number | null | undefined,
  realHome: number | null | undefined,
  realAway: number | null | undefined,
): ScoreUEFAResult {
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

  const pd = ph - pa;
  const rd = rh - ra;

  const sameWinner  = sign(pd) === sign(rd); // vencedor/empate correto
  const correctHome = ph === rh;             // golos equipa casa corretos
  const correctAway = pa === ra;             // golos equipa fora corretos
  const correctDiff = pd === rd;             // diferença de golos correta
  const isExact     = ph === rh && pa === ra;

  let points = 0;
  if (sameWinner)  points += P_WINNER;
  if (correctHome) points += P_HOME_GOALS;
  if (correctAway) points += P_AWAY_GOALS;
  if (correctDiff) points += P_DIFF;

  // Para critérios de desempate:
  // - exact: apenas quando é resultado exato
  // - diff:  diferença certa mas não exata
  // - winner: tendência correta, sem diff nem exato
  const exact  = isExact ? 1 : 0;
  const diff   = !isExact && correctDiff ? 1 : 0;
  const winner = !isExact && !diff && sameWinner ? 1 : 0;

  return { points, exact, diff, winner };
}

// Comparador comum aos 3 rankings: pontos → exatos → diferenças → tendência → palpite mais cedo
function cmpRanking<T extends {
  points: number; exact: number; diff: number; winner: number;
  first_pred_at?: number | null; // epoch ms; menor = mais cedo
}>(a: T, b: T) {
  if (b.points !== a.points)   return b.points  - a.points;
  if (b.exact  !== a.exact)    return b.exact   - a.exact;
  if (b.diff   !== a.diff)     return b.diff    - a.diff;
  if (b.winner !== a.winner)   return b.winner  - a.winner;
  const aa = a.first_pred_at ?? Number.POSITIVE_INFINITY;
  const bb = b.first_pred_at ?? Number.POSITIVE_INFINITY;
  return aa - bb; // mais cedo primeiro
}

/* ======================================================
   /api/rankings  (geral ou mensal se ?ym=YYYY-MM)

   Agora:
   - só conta jogos FINISHED
   - se ym existir, filtra por strftime('%Y-%m', fixtures.kickoff_at)
   - predictions.created_at só entra para desempate final
====================================================== */
rankings.get('/', async (c) => {
  const ym = c.req.query('ym'); // ex: '2025-10'  -> modo mensal

  // 1) Buscar todas as predictions JOIN fixtures FINISHED,
  //    filtrando por kickoff_at quando ym estiver presente
  const params: unknown[] = [];
  let where = `f.status = 'FINISHED'`;
  if (ym) {
    where += ` AND strftime('%Y-%m', f.kickoff_at) = ?`;
    params.push(ym);
  }

  const { results: rows } = await c.env.DB
    .prepare(
      `
      SELECT
        p.user_id,
        p.fixture_id,
        p.home_goals,
        p.away_goals,
        p.created_at,
        f.home_score,
        f.away_score,
        f.kickoff_at
      FROM predictions p
      JOIN fixtures f ON f.id = p.fixture_id
      WHERE ${where}
    `,
    )
    .bind(...params)
    .all<{
      user_id: string;
      fixture_id: string;
      home_goals: number;
      away_goals: number;
      created_at: string | null;
      home_score: number | null;
      away_score: number | null;
      kickoff_at: string;
    }>();

  const preds = rows ?? [];
  if (!preds.length) {
    return c.json([], 200);
  }

  // 2) Users (nome amigável)
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
    .all<{
      id: string;
      name: string;
      email: string | null;
      avatar_url: string | null;
    }>();

  const nameById   = new Map(users.results?.map(u => [u.id, u.name]) ?? []);
  const avatarById = new Map(users.results?.map(u => [u.id, u.avatar_url ?? null]) ?? []);

  type Acc = {
    user_id: string;
    name: string;
    avatar_url: string | null;
    points: number;
    exact: number;
    diff: number;
    winner: number;
    first_pred_at: number | null; // epoch ms do palpite mais antigo (entre os jogos que contam)
  };

  const score: Record<string, Acc> = {};

  for (const p of preds) {
    const uName = nameById.get(p.user_id) ?? 'Jogador';

    if (!score[p.user_id]) {
      score[p.user_id] = {
        user_id: p.user_id,
        name: uName,
        avatar_url: avatarById.get(p.user_id) ?? null,
        points: 0,
        exact: 0,
        diff: 0,
        winner: 0,
        first_pred_at: null,
      };
    }

    // Pontos (UEFA) — sempre com base no resultado oficial do jogo
    const s   = scoreUEFA(p.home_goals, p.away_goals, p.home_score, p.away_score);
    const acc = score[p.user_id];

    acc.points += s.points;
    acc.exact  += s.exact;
    acc.diff   += s.diff;
    acc.winner += s.winner;

    // Desempate final: palpite mais cedo (independente do mês)
    if (p.created_at) {
      const t = new Date(p.created_at).getTime();
      acc.first_pred_at = acc.first_pred_at == null ? t : Math.min(acc.first_pred_at, t);
    }
  }

  const ranking = Object.values(score).sort(cmpRanking);
  return c.json(ranking, 200);
});

/* ======================================================
   /api/rankings/months  -> meses com jogos FINISHED
   (baseado em kickoff_at, como queres)
====================================================== */
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
   /api/rankings/games  -> lista de jogos recentes
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
   /api/rankings/game?fixtureId=...
   Ranking por jogo (mostra todos os users; 0 pts sem palpite)
====================================================== */
rankings.get('/game', async (c) => {
  const fixtureId = c.req.query('fixtureId');
  if (!fixtureId) return c.json({ error: 'missing_fixtureId' }, 400);

  // Resultado oficial do jogo
  const fx = await c.env.DB
    .prepare(`
      SELECT id, status, home_score, away_score
      FROM fixtures
      WHERE id = ?
      LIMIT 1
    `)
    .bind(fixtureId)
    .first<{
      id: string;
      status: string;
      home_score: number | null;
      away_score: number | null;
    }>();

  if (!fx) return c.json({ error: 'fixture_not_found' }, 404);

  // Users + palpite (se existir) + timestamp do palpite
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
        p.away_goals                       AS pred_away,
        p.created_at                       AS pred_created_at
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
      pred_created_at: string | null;
    }>();

  const rows = (results ?? []).map(r => {
    const s = scoreUEFA(r.pred_home, r.pred_away, fx.home_score, fx.away_score);
    const first_pred_at = r.pred_created_at
      ? new Date(r.pred_created_at).getTime()
      : null;

    return {
      user_id: r.user_id,
      name: r.name ?? 'Jogador',
      avatar_url: r.avatar_url,
      points: s.points,
      exact: s.exact,
      diff: s.diff,
      winner: s.winner,
      first_pred_at, // para desempate final
    };
  });

  rows.sort(cmpRanking);
  return c.json(rows, 200);
});
