import { Hono } from 'hono';
import { scoreUEFA } from './rankings';

type Env = { DB: D1Database };
export const winners = new Hono<{ Bindings: Env }>();

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

type RowScore = {
  user_id: string;
  name: string;
  email: string | null;
  points: number;
  exact: number;
  diff: number;
  winner: number;
  scorer_hits: number;
  first_pred_at: number | null;
};

function cmpRanking(a: RowScore, b: RowScore) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.exact !== a.exact) return b.exact - a.exact;
  if (b.diff !== a.diff) return b.diff - a.diff;
  if (b.winner !== a.winner) return b.winner - a.winner;
  const aa = a.first_pred_at ?? Number.POSITIVE_INFINITY;
  const bb = b.first_pred_at ?? Number.POSITIVE_INFINITY;
  return aa - bb;
}

winners.get('/months', async (c) => {
  const { results } = await c.env.DB
    .prepare(`
      SELECT DISTINCT strftime('%Y-%m', kickoff_at) AS ym
      FROM fixtures
      WHERE status='FINISHED'
      ORDER BY ym DESC
    `)
    .all<{ ym: string }>();

  return c.json((results ?? []).map((r) => r.ym), 200);
});

winners.get('/', async (c) => {
  const ym = c.req.query('ym');

  const params: unknown[] = [];
  let where = `f.status = 'FINISHED'`;
  if (ym) {
    where += ` AND strftime('%Y-%m', f.kickoff_at) = ?`;
    params.push(ym);
  }

  const { results: predRows } = await c.env.DB
    .prepare(
      `
      SELECT
        p.user_id,
        p.fixture_id,
        p.home_goals,
        p.away_goals,
        p.scorer_player_id,
        p.created_at,
        f.kickoff_at,
        f.home_score,
        f.away_score,
        ht.name AS home_team_name,
        at.name AS away_team_name,
        co.code AS competition_code,
        f.round_label
      FROM predictions p
      JOIN fixtures f ON f.id = p.fixture_id
      JOIN teams ht ON ht.id = f.home_team_id
      JOIN teams at ON at.id = f.away_team_id
      LEFT JOIN competitions co ON co.id = f.competition_id
      WHERE ${where}
    `,
    )
    .bind(...params)
    .all<{
      user_id: string;
      fixture_id: string;
      home_goals: number;
      away_goals: number;
      scorer_player_id: string | number | null;
      created_at: string | null;
      kickoff_at: string;
      home_score: number | null;
      away_score: number | null;
      home_team_name: string;
      away_team_name: string;
      competition_code: string | null;
      round_label: string | null;
    }>();

  const preds = predRows ?? [];
  if (!preds.length) {
    return c.json([], 200);
  }

  const { results: scorerRows } = await c.env.DB
    .prepare(
      `
      SELECT
        fs.fixture_id,
        fs.player_id,
        p.position
      FROM fixture_scorers fs
      LEFT JOIN players p ON p.id = fs.player_id
      JOIN fixtures f ON f.id = fs.fixture_id
      WHERE ${where}
    `,
    )
    .bind(...params)
    .all<{ fixture_id: string; player_id: string; position: string | null }>();

  const bonusByFixtureAndPlayer = new Map<string, number>();
  for (const r of scorerRows ?? []) {
    const bonus = scorerBonusForPosition(r.position);
    if (!bonus) continue;
    const key = `${r.fixture_id}:${String(r.player_id)}`;
    bonusByFixtureAndPlayer.set(key, bonus);
  }

  const { results: userRows } = await c.env.DB
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
        u.email
      FROM users u
    `)
    .all<{ id: string; name: string; email: string | null }>();

  const nameById = new Map((userRows ?? []).map((u) => [u.id, u.name]));
  const emailById = new Map((userRows ?? []).map((u) => [u.id, u.email]));

  type FixtureInfo = {
    fixture_id: string;
    kickoff_at: string;
    home_team_name: string;
    away_team_name: string;
    competition_code: string | null;
    round_label: string | null;
  };

  const fixtureInfoById = new Map<string, FixtureInfo>();

  const byFixture: Record<string, Record<string, RowScore>> = {};

  for (const p of preds) {
    if (!fixtureInfoById.has(p.fixture_id)) {
      fixtureInfoById.set(p.fixture_id, {
        fixture_id: p.fixture_id,
        kickoff_at: p.kickoff_at,
        home_team_name: p.home_team_name,
        away_team_name: p.away_team_name,
        competition_code: p.competition_code,
        round_label: p.round_label,
      });
    }

    if (!byFixture[p.fixture_id]) byFixture[p.fixture_id] = {};

    const uName = nameById.get(p.user_id) ?? 'Jogador';
    const uEmail = emailById.get(p.user_id) ?? null;

    if (!byFixture[p.fixture_id][p.user_id]) {
      byFixture[p.fixture_id][p.user_id] = {
        user_id: p.user_id,
        name: uName,
        email: uEmail,
        points: 0,
        exact: 0,
        diff: 0,
        winner: 0,
        scorer_hits: 0,
        first_pred_at: null,
      };
    }

    const acc = byFixture[p.fixture_id][p.user_id];
    const s = scoreUEFA(p.home_goals, p.away_goals, p.home_score, p.away_score);

    let pts = s.points;
    let hitScorer = false;

    if (p.scorer_player_id != null) {
      const key = `${p.fixture_id}:${String(p.scorer_player_id)}`;
      const bonus = bonusByFixtureAndPlayer.get(key) ?? 0;
      if (bonus) {
        pts += bonus;
        hitScorer = true;
      }
    }

    acc.points += pts;
    acc.exact += s.exact;
    acc.diff += s.diff;
    acc.winner += s.winner;
    if (hitScorer) acc.scorer_hits += 1;

    if (p.created_at) {
      const t = new Date(p.created_at).getTime();
      acc.first_pred_at = acc.first_pred_at == null ? t : Math.min(acc.first_pred_at, t);
    }
  }

  const winnersList = Object.keys(byFixture)
    .map((fixtureId) => {
      const scores = Object.values(byFixture[fixtureId] ?? {});
      scores.sort(cmpRanking);
      const top = scores[0];
      const fx = fixtureInfoById.get(fixtureId);
      if (!top || !fx) return null;

      return {
        ym: new Date(fx.kickoff_at).toISOString().slice(0, 7),
        fixture_id: fx.fixture_id,
        kickoff_at: fx.kickoff_at,
        home_team_name: fx.home_team_name,
        away_team_name: fx.away_team_name,
        competition_code: fx.competition_code,
        round_label: fx.round_label,
        user_id: top.user_id,
        name: top.name,
        email: top.email,
        points: top.points,
        exact: top.exact,
        diff: top.diff,
        winner: top.winner,
        scorer_hits: top.scorer_hits,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const da = new Date((a as any).kickoff_at).getTime();
      const db = new Date((b as any).kickoff_at).getTime();
      return db - da;
    });

  return c.json(winnersList, 200);
});

winners.get('/monthly', async (c) => {
  const ym = c.req.query('ym');
  if (!ym) return c.json({ error: 'missing_ym' }, 400);

  const params: unknown[] = [ym];
  const where = `f.status = 'FINISHED' AND strftime('%Y-%m', f.kickoff_at) = ?`;

  const { results: rows } = await c.env.DB
    .prepare(
      `
      SELECT
        p.user_id,
        p.fixture_id,
        p.home_goals,
        p.away_goals,
        p.scorer_player_id,
        p.created_at,
        f.home_score,
        f.away_score
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
      scorer_player_id: string | number | null;
      created_at: string | null;
      home_score: number | null;
      away_score: number | null;
    }>();

  const preds = rows ?? [];
  if (!preds.length) return c.json([], 200);

  const { results: scorerRows } = await c.env.DB
    .prepare(
      `
      SELECT
        fs.fixture_id,
        fs.player_id,
        p.position
      FROM fixture_scorers fs
      LEFT JOIN players p ON p.id = fs.player_id
      JOIN fixtures f ON f.id = fs.fixture_id
      WHERE ${where}
    `,
    )
    .bind(...params)
    .all<{ fixture_id: string; player_id: string; position: string | null }>();

  const bonusByFixtureAndPlayer = new Map<string, number>();
  for (const r of scorerRows ?? []) {
    const bonus = scorerBonusForPosition(r.position);
    if (!bonus) continue;
    const key = `${r.fixture_id}:${String(r.player_id)}`;
    bonusByFixtureAndPlayer.set(key, bonus);
  }

  const { results: userRows } = await c.env.DB
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
        u.email
      FROM users u
    `)
    .all<{ id: string; name: string; email: string | null }>();

  const nameById = new Map((userRows ?? []).map((u) => [u.id, u.name]));
  const emailById = new Map((userRows ?? []).map((u) => [u.id, u.email]));

  const score: Record<string, RowScore> = {};

  for (const p of preds) {
    const uName = nameById.get(p.user_id) ?? 'Jogador';
    const uEmail = emailById.get(p.user_id) ?? null;

    if (!score[p.user_id]) {
      score[p.user_id] = {
        user_id: p.user_id,
        name: uName,
        email: uEmail,
        points: 0,
        exact: 0,
        diff: 0,
        winner: 0,
        scorer_hits: 0,
        first_pred_at: null,
      };
    }

    const acc = score[p.user_id];
    const s = scoreUEFA(p.home_goals, p.away_goals, p.home_score, p.away_score);

    let pts = s.points;
    let hitScorer = false;

    if (p.scorer_player_id != null) {
      const key = `${p.fixture_id}:${String(p.scorer_player_id)}`;
      const bonus = bonusByFixtureAndPlayer.get(key) ?? 0;
      if (bonus) {
        pts += bonus;
        hitScorer = true;
      }
    }

    acc.points += pts;
    acc.exact += s.exact;
    acc.diff += s.diff;
    acc.winner += s.winner;
    if (hitScorer) acc.scorer_hits += 1;

    if (p.created_at) {
      const t = new Date(p.created_at).getTime();
      acc.first_pred_at = acc.first_pred_at == null ? t : Math.min(acc.first_pred_at, t);
    }
  }

  const top3 = Object.values(score)
    .sort(cmpRanking)
    .slice(0, 3)
    .map((r) => ({
      ym,
      user_id: r.user_id,
      name: r.name,
      email: r.email,
    }));

  return c.json(top3, 200);
});
