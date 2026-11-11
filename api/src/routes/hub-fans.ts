import { Hono } from 'hono';
import { getActiveSeasonId } from '../app-settings';
import {
  getPortoCalendar,
  getPortoGame,
  isSportsKgmid,
  PortoFixtureNotFound,
  SerpApiError,
} from '../serpapi-sports';

type Env = { DB: D1Database; HUB_NEWS_KEY?: string; SERPAPI_API_KEY?: string };
type Player = { id: number; name: string; position: string };
type Fixture = {
  id: string;
  kickoffAt: string | null;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  competition: string | null;
};
type Rating = { playerId: number; rating: number };

const maxPlayers = 23;
const portoFixture = `(
  f.home_team_id = 'fcp' OR f.away_team_id = 'fcp'
  OR LOWER(TRIM(ht.name)) IN ('fc porto', 'futebol clube do porto')
  OR LOWER(TRIM(at.name)) IN ('fc porto', 'futebol clube do porto')
)`;
const fixtureTeams = `
  FROM fixtures f
  JOIN matchdays md ON md.id = f.matchday_id
  JOIN teams ht ON ht.id = f.home_team_id
  JOIN teams at ON at.id = f.away_team_id
`;
const finishedFixtures = `${fixtureTeams}
  WHERE md.season_id = ? AND f.status = 'FINISHED' AND ${portoFixture}
`;
const fixtureColumns = `
  f.id, strftime('%Y-%m-%dT%H:%M:%fZ', f.kickoff_at) AS kickoffAt,
  ht.name AS home, at.name AS away,
  f.home_score AS homeScore, f.away_score AS awayScore,
  (SELECT name FROM competitions WHERE id = f.competition_id) AS competition
`;
const validFixture = `SELECT f.id ${finishedFixtures} AND f.id = ?`;

export const hubFans = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

hubFans.use('*', async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  const key = c.env.HUB_NEWS_KEY?.trim();
  const userId = c.req.header('x-hub-user-id');
  if (!key || c.req.header('x-hub-news-key') !== key || !userId || userId.length > 128) {
    return c.body(null, 404);
  }
  const admin = await c.env.DB.prepare("SELECT id FROM users WHERE id = ? AND role = 'admin'")
    .bind(userId).first();
  if (!admin) return c.body(null, 404);
  c.set('userId', userId);
  await next();
});

hubFans.get('/serpapi', async (c) => {
  const apiKey = c.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) return c.json({ error: 'serpapi_not_configured' }, 503);

  const kgmid = c.req.query('kgmid');
  if (kgmid !== undefined && !isSportsKgmid(kgmid)) {
    return c.json({ error: 'invalid_kgmid' }, 400);
  }

  try {
    if (!kgmid) return c.json(await getPortoCalendar(apiKey));

    const { results } = await readPlayers(c.env.DB, true);
    return c.json(await getPortoGame(apiKey, kgmid, results ?? []));
  } catch (error) {
    if (error instanceof PortoFixtureNotFound) return c.json({ error: 'not_porto_fixture' }, 404);
    if (error instanceof SerpApiError) {
      return c.json({ error: error.code, upstreamStatus: error.upstreamStatus, detail: error.detail }, 502);
    }
    return c.json({ error: 'serpapi_unavailable' }, 502);
  }
});

function readPlayers(db: D1Database, includeInactive = false) {
  return db.prepare(`
    SELECT id, name, position
    FROM players
    WHERE team_id = 'fcp' ${includeInactive ? '' : 'AND is_active = 1'}
    ORDER BY is_active DESC, CASE position WHEN 'GR' THEN 1 WHEN 'D' THEN 2 WHEN 'M' THEN 3 ELSE 4 END, name
  `).all<Player>();
}

function readFixture(db: D1Database, season: string, id: string) {
  return db.prepare(`SELECT ${fixtureColumns} ${finishedFixtures} AND f.id = ?`)
    .bind(season, id).first<Fixture>();
}

function readEligibility(db: D1Database, fixtureId: string) {
  return db.prepare('SELECT player_id FROM hub_rating_players WHERE fixture_id = ?')
    .bind(fixtureId).all<{ player_id: number }>();
}

function readRanking(db: D1Database, season: string) {
  return db.prepare(`
    WITH match_means AS (
      SELECT player_id, AVG(rating) AS mean, COUNT(*) AS votes
      FROM hub_player_ratings
      WHERE fixture_id IN (SELECT f.id ${finishedFixtures})
      GROUP BY fixture_id, player_id
    )
    SELECT p.id, p.name, p.position, COUNT(*) AS matches, SUM(m.votes) AS votes,
      AVG(m.mean) AS average,
      (SUM(m.mean) + 5 * (SELECT AVG(mean) FROM match_means)) / (COUNT(*) + 5) AS adjusted
    FROM match_means m JOIN players p ON p.id = m.player_id
    GROUP BY p.id
    ORDER BY adjusted DESC, matches DESC, p.name, p.id
  `).bind(season).all<Player & { matches: number; votes: number; average: number; adjusted: number }>();
}

hubFans.get('/plantel', async (c) => {
  const db = c.env.DB;
  const season = await getActiveSeasonId(db);
  const [players, fixture] = await Promise.all([
    readPlayers(db),
    db.prepare(`
      SELECT ${fixtureColumns} ${fixtureTeams}
      WHERE md.season_id = ? AND f.status IN ('SCHEDULED', 'TIMED') AND ${portoFixture}
        AND datetime(f.kickoff_at) > datetime(?)
      ORDER BY datetime(f.kickoff_at), f.id LIMIT 1
    `).bind(season, new Date(Date.now()).toISOString()).first<Fixture>(),
  ]);
  return c.json({ players: players.results, next: fixture });
});

hubFans.get('/notas', async (c) => {
  const db = c.env.DB;
  const season = await getActiveSeasonId(db);
  const fixtureId = c.req.query('jogo');

  if (fixtureId !== undefined) {
    if (!fixtureId || fixtureId.length > 128) return c.json({ error: 'invalid_fixture' }, 400);
    const fixture = await readFixture(db, season, fixtureId);
    if (!fixture) return c.json({ error: 'fixture_not_found' }, 404);

    const { results } = await db.prepare(`
      SELECT p.id, p.name, p.position, AVG(r.rating) AS average, COUNT(r.rating) AS votes,
        MAX(CASE WHEN r.user_id = ? THEN r.rating END) AS mine
      FROM hub_rating_players rp
      JOIN players p ON p.id = rp.player_id
      LEFT JOIN hub_player_ratings r ON r.fixture_id = rp.fixture_id AND r.player_id = rp.player_id
      WHERE rp.fixture_id = ?
      GROUP BY p.id
      ORDER BY CASE p.position WHEN 'GR' THEN 1 WHEN 'D' THEN 2 WHEN 'M' THEN 3 ELSE 4 END, p.name
    `).bind(c.get('userId'), fixtureId).all<Player & { average: number | null; votes: number; mine: number | null }>();

    return c.json({
      fixture,
      eligible: results,
      roster: results.length ? [] : (await readPlayers(db, true)).results,
    });
  }

  const [fixtures, ranking, seasonRow] = await Promise.all([
    db.prepare(`
      SELECT ${fixtureColumns},
        EXISTS (SELECT 1 FROM hub_rating_matches rm WHERE rm.fixture_id = f.id) AS opened
      ${finishedFixtures}
      ORDER BY datetime(f.kickoff_at) DESC, f.id
    `).bind(season).all<Fixture & { opened: number }>(),
    readRanking(db, season),
    db.prepare('SELECT name FROM seasons WHERE id = ?').bind(season).first<{ name: string }>(),
  ]);

  return c.json({ season: seasonRow?.name ?? season, fixtures: fixtures.results, ranking: ranking.results });
});

hubFans.post('/notas', async (c) => {
  const db = c.env.DB;
  const fixtureId = c.req.query('jogo');
  const body = await c.req.json<{ players?: unknown }>().catch(() => null);
  const ids = body?.players;
  if (!fixtureId || fixtureId.length > 128 || !Array.isArray(ids) || ids.length < 11 || ids.length > maxPlayers ||
      !ids.every((id) => Number.isSafeInteger(id) && id > 0) || new Set(ids).size !== ids.length) {
    return c.json({ error: 'invalid_players' }, 400);
  }

  const season = await getActiveSeasonId(db);
  if (!(await readFixture(db, season, fixtureId))) return c.json({ error: 'fixture_not_found' }, 404);
  const roster = new Set((await readPlayers(db, true)).results.map((player) => player.id));
  if (!ids.every((id) => roster.has(id))) return c.json({ error: 'invalid_players' }, 400);

  const values = ids.map(() => '(?, ?)').join(', ');
  try {
    await db.batch([
      db.prepare(`INSERT INTO hub_rating_matches (fixture_id) ${validFixture}`).bind(season, fixtureId),
      db.prepare(`INSERT INTO hub_rating_players (fixture_id, player_id) VALUES ${values}`)
        .bind(...ids.flatMap((id) => [fixtureId, id])),
    ]);
  } catch (error) {
    const opened = await db.prepare('SELECT 1 FROM hub_rating_matches WHERE fixture_id = ?').bind(fixtureId).first();
    if (opened) return c.json({ error: 'already_open' }, 409);
    if (!(await readFixture(db, season, fixtureId))) return c.json({ error: 'fixture_not_found' }, 404);
    throw error;
  }

  return c.json({ ok: true }, 201);
});

function isRating(value: unknown): value is Rating {
  if (!value || typeof value !== 'object') return false;
  const { playerId, rating } = value as Partial<Rating>;
  return Number.isSafeInteger(playerId) && (playerId ?? 0) > 0 &&
    typeof rating === 'number' && Number.isInteger(rating) && rating >= 0 && rating <= 10;
}

hubFans.put('/notas', async (c) => {
  const db = c.env.DB;
  const fixtureId = c.req.query('jogo');
  const body = await c.req.json<{ ratings?: unknown }>().catch(() => null);
  const ratings = body?.ratings;
  if (!fixtureId || fixtureId.length > 128 || !Array.isArray(ratings) || ratings.length > maxPlayers ||
      !ratings.every(isRating) || new Set(ratings.map(({ playerId }) => playerId)).size !== ratings.length) {
    return c.json({ error: 'invalid_ratings' }, 400);
  }

  const season = await getActiveSeasonId(db);
  const { results } = await readEligibility(db, fixtureId);
  if (!results.length) return c.json({ error: 'not_open' }, 409);
  const eligible = new Set(results.map(({ player_id }) => player_id));
  if (!ratings.every(({ playerId }) => eligible.has(playerId))) return c.json({ error: 'invalid_ratings' }, 400);

  const userId = c.get('userId');
  // Replace the ballot together so a retry cannot create duplicate votes.
  const statements = [
    db.prepare(validFixture).bind(season, fixtureId),
    db.prepare(`
      DELETE FROM hub_player_ratings WHERE fixture_id = ? AND user_id = ?
      AND EXISTS (${validFixture})
    `).bind(fixtureId, userId, season, fixtureId),
  ];
  if (ratings.length) {
    const values = ratings.map(() => '(?, ?)').join(', ');
    statements.push(db.prepare(`
      WITH selected(player_id, rating) AS (VALUES ${values})
      INSERT INTO hub_player_ratings (fixture_id, player_id, user_id, rating)
      SELECT ?, player_id, ?, rating FROM selected
      WHERE EXISTS (${validFixture})
    `).bind(...ratings.flatMap(({ playerId, rating }) => [playerId, rating]), fixtureId, userId, season, fixtureId));
  }

  const [valid] = await db.batch(statements);
  if (!valid.results.length) return c.json({ error: 'fixture_not_found' }, 404);
  return c.json({ ok: true });
});
