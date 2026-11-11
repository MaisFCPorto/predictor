import { getActiveMatchdayId, getActiveSeasonId } from './app-settings';
import { getPortoCalendar, getPortoGame, SerpApiError, type PortoCalendarGame, type PortoGame } from './serpapi-sports';
import { predictionPoints, scorerBonusForPosition } from './routes/admin';

export const FOOTBALL_CRON = '*/5 * * * *';
const minute = 60_000;
const day = 24 * 60 * minute;
const portoKgmid = '/m/0177gl';
const leagueKgmid = '/m/03n_lr';
const retryMinutes = [15, 30, 60, 120, 360];

export type FootballEnv = {
  DB: D1Database;
  SERPAPI_API_KEY?: string;
  FOOTBALL_AUTOMATION_ENABLED?: string;
};
type CalendarRow = {
  season_id: string;
  kgmid: string;
  kickoff_at: string | null;
  kickoff_date: string | null;
  kickoff_confirmed: number;
  provider_status: string | null;
  calendar_json: string;
  fixture_id: string | null;
  final_json: string | null;
  finalized_at: number | null;
  attempts: number;
  lease_token: string | null;
};
type RosterPlayer = { id: number; name: string; position: string };

// Unknown names stay pending. Never pick an approximate team or competition.
function normalized(value: string) {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

async function teamId(db: D1Database, team: PortoCalendarGame['teams'][number]) {
  if (team.kgmid) {
    const linked = await db.prepare('SELECT team_id AS id FROM football_team_links WHERE kgmid = ?')
      .bind(team.kgmid).first<{ id: string }>();
    if (linked) return linked.id;
  }
  if (!team.name) return null;
  const { results } = await db.prepare('SELECT id, name, short_name FROM teams')
    .all<{ id: string; name: string; short_name: string | null }>();
  const name = normalized(team.name);
  const matches = results.filter((row) => normalized(row.name) === name || (row.short_name && normalized(row.short_name) === name));
  return matches.length === 1 ? matches[0].id : null;
}

async function competitionId(db: D1Database, game: PortoCalendarGame) {
  const competition = game.competition;
  if (competition?.kgmid) {
    const linked = await db.prepare('SELECT competition_id AS id FROM football_competition_links WHERE kgmid = ?')
      .bind(competition.kgmid).first<{ id: string }>();
    if (linked) return linked.id;
  }
  if (!competition?.name) return null;
  const { results } = await db.prepare('SELECT id, name FROM competitions').all<{ id: string; name: string }>();
  const matches = results.filter((row) => normalized(row.name) === normalized(competition.name!));
  return matches.length === 1 ? matches[0].id : null;
}

export async function refreshFootballCalendar(env: FootballEnv, now = Date.now()) {
  if (env.FOOTBALL_AUTOMATION_ENABLED !== 'true') return { refreshed: false, reason: 'disabled' };
  if (!env.SERPAPI_API_KEY?.trim()) return { refreshed: false, reason: 'missing_key' };
  const db = env.DB;
  const season = await getActiveSeasonId(db);
  await db.prepare('INSERT OR IGNORE INTO football_sync_state (season_id) VALUES (?)').bind(season).run();
  const token = crypto.randomUUID();
  const claim = await db.prepare(`
    UPDATE football_sync_state SET lease_token = ?, lease_until = ?
    WHERE season_id = ? AND lease_until <= ? AND refresh_after <= ?
    RETURNING season_id
  `).bind(token, now + 2 * minute, season, now, now).first();
  if (!claim) return { refreshed: false, reason: 'not_due' };

  try {
    const { games } = await getPortoCalendar(env.SERPAPI_API_KEY.trim());
    const pending = games.some((game) => !game.kickoffConfirmed && game.status === 'upcoming');
    const statements = [db.prepare(`
      WITH incoming AS (SELECT value AS game FROM json_each(?))
      INSERT INTO football_calendar
        (season_id, kgmid, kickoff_at, kickoff_date, kickoff_confirmed, provider_status, calendar_json)
      SELECT ?, json_extract(game, '$.kgmid'), json_extract(game, '$.kickoffAt'),
        json_extract(game, '$.kickoffDate'), json_extract(game, '$.kickoffConfirmed'),
        json_extract(game, '$.status'), game FROM incoming WHERE EXISTS (
        SELECT 1 FROM football_sync_state WHERE season_id = ? AND lease_token = ?
      )
      ON CONFLICT (season_id, kgmid) DO UPDATE SET
        kickoff_at = excluded.kickoff_at, kickoff_date = excluded.kickoff_date,
        kickoff_confirmed = excluded.kickoff_confirmed, provider_status = excluded.provider_status,
        calendar_json = excluded.calendar_json
    `).bind(JSON.stringify(games), season, season, token)];
    statements.push(db.prepare(`
      UPDATE football_sync_state SET refreshed_at = ?, refresh_after = ?, lease_token = NULL, lease_until = 0
      WHERE season_id = ? AND lease_token = ?
    `).bind(now, now + (pending ? 3 : 7) * day, season, token));
    await db.batch(statements);
    return { refreshed: true, count: games.length };
  } catch (error) {
    // A failing provider must not be called again on every five-minute tick.
    await db.prepare(`UPDATE football_sync_state SET refresh_after = ?, lease_token = NULL, lease_until = 0
      WHERE season_id = ? AND lease_token = ?`).bind(now + 6 * 60 * minute, season, token).run();
    throw error;
  }
}

function selectedGames(rows: CalendarRow[], now: number) {
  // Keep the current pair until its running game has been imported successfully.
  if (rows.some((row) => row.fixture_id && row.attempts <= retryMinutes.length && row.kickoff_at && Date.parse(row.kickoff_at) <= now &&
      !['postponed', 'cancelled'].includes(row.provider_status ?? ''))) return [];
  const upcoming = rows.filter((row) => row.kickoff_confirmed && row.kickoff_at &&
    Date.parse(row.kickoff_at) > now && row.provider_status === 'upcoming');
  upcoming.sort((a, b) => Date.parse(a.kickoff_at!) - Date.parse(b.kickoff_at!));
  const nextLeague = rows.filter((row) => row.provider_status === 'upcoming' &&
      Date.parse(row.kickoff_at ?? row.kickoff_date ?? '') > now &&
      (JSON.parse(row.calendar_json) as PortoCalendarGame).competition?.kgmid === leagueKgmid)
    .sort((a, b) => Date.parse(a.kickoff_at ?? a.kickoff_date!) - Date.parse(b.kickoff_at ?? b.kickoff_date!))[0];
  if (nextLeague && !nextLeague.kickoff_confirmed) {
    return upcoming.filter((row) => (JSON.parse(row.calendar_json) as PortoCalendarGame).competition?.kgmid !== leagueKgmid).slice(0, 1);
  }
  // In a break without a league date, the nearest confirmed match can still open.
  if (!nextLeague) return upcoming.slice(0, 1);
  const anchor = Date.parse(nextLeague.kickoff_at!);
  return upcoming.filter((row) => row === nextLeague || (
    (JSON.parse(row.calendar_json) as PortoCalendarGame).competition?.kgmid !== leagueKgmid &&
    Math.abs(Date.parse(row.kickoff_at!) - anchor) < 7 * day
  ));
}

async function syncStoredFixtureTimes(db: D1Database, rows: CalendarRow[]) {
  for (const row of rows) {
    if (!row.fixture_id || row.final_json) continue;
    const fixture = await db.prepare('SELECT kickoff_at, status FROM fixtures WHERE id = ?')
      .bind(row.fixture_id).first<{ kickoff_at: string; status: string }>();
    if (!fixture || fixture.status === 'FINISHED') continue;
    const suspended = !row.kickoff_confirmed || ['postponed', 'cancelled'].includes(row.provider_status ?? '');
    const status = suspended ? (row.provider_status === 'cancelled' ? 'CANCELLED' : 'POSTPONED') : 'SCHEDULED';
    const kickoff = suspended ? fixture.kickoff_at : row.kickoff_at!;
    if (fixture.kickoff_at === kickoff && fixture.status === status) continue;
    await db.batch([
      db.prepare(`UPDATE fixtures SET kickoff_at = ?, status = ?
        WHERE id = ? AND kickoff_at = ? AND status <> 'FINISHED' AND home_score IS NULL AND away_score IS NULL`)
        .bind(kickoff, status, row.fixture_id, fixture.kickoff_at),
      db.prepare(`UPDATE football_calendar SET check_after = ?, attempts = 0
        WHERE season_id = ? AND kgmid = ? AND finalized_at IS NULL AND final_json IS NULL`)
        .bind(Date.parse(kickoff) + 120 * minute, row.season_id, row.kgmid),
    ]);
  }
}

async function openGame(db: D1Database, row: CalendarRow) {
  if (row.fixture_id) return false;
  const game = JSON.parse(row.calendar_json) as PortoCalendarGame;
  const [home, away, competition, matchday] = await Promise.all([
    teamId(db, game.teams[0]), teamId(db, game.teams[1]), competitionId(db, game), getActiveMatchdayId(db),
  ]);
  const error = !home || !away ? 'unmatched_team' : !competition ? 'unmatched_competition' : null;
  if (error) {
    await db.prepare('UPDATE football_calendar SET last_error = ? WHERE season_id = ? AND kgmid = ?')
      .bind(error, row.season_id, row.kgmid).run();
    return false;
  }
  const md = await db.prepare('SELECT season_id FROM matchdays WHERE id = ?').bind(matchday).first<{ season_id: string }>();
  if (md?.season_id !== row.season_id) throw new Error('automation_matchday_season_mismatch');

  // Existing manual fixtures are left for an admin to link explicitly.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${row.season_id}\0${row.kgmid}`));
  const id = 'auto-' + [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
  const existing = await db.prepare(`SELECT f.id FROM fixtures f JOIN matchdays md ON md.id = f.matchday_id
    WHERE md.season_id = ? AND f.home_team_id = ? AND f.away_team_id = ? AND f.competition_id = ?
      AND ABS(julianday(f.kickoff_at) - julianday(?)) < 2 LIMIT 1`)
    .bind(row.season_id, home, away, competition, row.kickoff_at).first<{ id: string }>();
  if (existing && existing.id !== id) {
    await db.prepare("UPDATE football_calendar SET last_error = 'existing_fixture_requires_link' WHERE season_id = ? AND kgmid = ?")
      .bind(row.season_id, row.kgmid).run();
    return false;
  }
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO fixtures
      (id, matchday_id, home_team_id, away_team_id, competition_id, kickoff_at, status)
      SELECT ?, ?, ?, ?, ?, ?, 'SCHEDULED' FROM football_calendar
      WHERE season_id = ? AND kgmid = ? AND fixture_id IS NULL`)
      .bind(id, matchday, home, away, competition, row.kickoff_at, row.season_id, row.kgmid),
    db.prepare(`UPDATE football_calendar SET fixture_id = ?, check_after = ?, last_error = NULL
      WHERE season_id = ? AND kgmid = ? AND fixture_id IS NULL`)
      .bind(id, Date.parse(row.kickoff_at!) + 120 * minute, row.season_id, row.kgmid),
  ]);
  return true;
}

function finalData(game: PortoGame): { error: string } | { home: number; away: number; participants: number[]; scorers: number[] } {
  if (game.fixture.status !== 'finished') return { error: 'match_not_finished' } as const;
  const scores = game.fixture.teams.map((team) => team.score);
  if (!scores.every((score) => score !== null && Number.isSafeInteger(score) && score >= 0)) {
    return { error: 'missing_score' } as const;
  }
  const { starters, substitutions, scorers } = game.porto;
  if (!starters || starters.length !== 11 || !substitutions || !scorers) return { error: 'missing_match_data' } as const;
  const starting = starters.map((player) => player?.predictorPlayer?.id);
  if (starting.some((id) => !id) || new Set(starting).size !== 11) return { error: 'unmatched_player' } as const;
  const participants = new Set(starting as number[]);
  const playing = new Set(starting as number[]);
  for (const sub of [...substitutions].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || (a.stoppageMinute ?? 0) - (b.stoppageMinute ?? 0))) {
    const incoming = sub.playerIn?.predictorPlayer?.id;
    const outgoing = sub.playerOut?.predictorPlayer?.id;
    if (!incoming || !outgoing) return { error: 'unmatched_player' } as const;
    if (sub.minute === null || !playing.has(outgoing) || participants.has(incoming)) return { error: 'invalid_substitutions' };
    playing.delete(outgoing);
    playing.add(incoming);
    participants.add(incoming);
    participants.add(outgoing);
  }
  if (participants.size > 23) return { error: 'invalid_participants' } as const;

  const portoScore = game.fixture.teams.find((team) => team.kgmid === portoKgmid)?.score;
  const goals = scorers.flatMap((entry) => entry.goals);
  if (goals.length !== portoScore) return { error: 'incomplete_scorers' } as const;
  const ids = new Set<number>();
  for (const entry of scorers) {
    // An opponent's own goal counts towards the result, never a Porto scorer bonus.
    if (!entry.goals.some((goal) => !goal.ownGoal)) continue;
    const id = entry.player?.predictorPlayer?.id;
    if (!id || !participants.has(id)) return { error: 'unmatched_scorer' } as const;
    ids.add(id);
  }
  return { home: scores[0]!, away: scores[1]!, participants: [...participants], scorers: [...ids] };
}

async function publishFinal(db: D1Database, row: CalendarRow, game: PortoGame, players: RosterPlayer[], token: string, now: number) {
  const data = finalData(game);
  if ('error' in data) return data.error;
  const current = await db.prepare('SELECT status, home_score, away_score FROM fixtures WHERE id = ?')
    .bind(row.fixture_id).first<{ status: string; home_score: number | null; away_score: number | null }>();
  if (!current || current.status === 'FINISHED' || current.home_score !== null || current.away_score !== null ||
      await db.prepare('SELECT 1 FROM fixture_scorers WHERE fixture_id = ? LIMIT 1').bind(row.fixture_id).first() ||
      await db.prepare('SELECT 1 FROM hub_rating_matches WHERE fixture_id = ?').bind(row.fixture_id).first()) {
    return 'manual_result_requires_review';
  }
  const { results: predictions } = await db.prepare(`SELECT id, home_goals, away_goals, scorer_player_id
    FROM predictions WHERE fixture_id = ?`).bind(row.fixture_id)
    .all<{ id: string; home_goals: number | null; away_goals: number | null; scorer_player_id: string | null }>();
  const bonus = new Map(data.scorers.map((id) => [String(id), scorerBonusForPosition(players.find((p) => p.id === id)?.position)]));
  // Every statement is guarded by the same lease. D1 batch publishes all data atomically.
  const gate = 'EXISTS (SELECT 1 FROM football_calendar WHERE season_id = ? AND kgmid = ? AND lease_token = ? AND finalized_at IS NULL)';
  const args = [row.season_id, row.kgmid, token];
  // One JSON parameter avoids the 100-parameter limit and a query per user.
  const points = predictions.map((p) => ({ id: p.id, points: predictionPoints(p, data.home, data.away, bonus) }));
  const statements = [
    // A manual update between our read and this transaction wins over automation.
    db.prepare(`UPDATE football_calendar SET lease_token = NULL, lease_until = 0,
      last_error = 'manual_result_requires_review', attempts = ?
      WHERE season_id = ? AND kgmid = ? AND lease_token = ? AND (
        EXISTS (SELECT 1 FROM fixtures WHERE id = ? AND (status = 'FINISHED' OR home_score IS NOT NULL OR away_score IS NOT NULL))
        OR EXISTS (SELECT 1 FROM fixture_scorers WHERE fixture_id = ?)
        OR EXISTS (SELECT 1 FROM hub_rating_matches WHERE fixture_id = ?)
      )`).bind(retryMinutes.length + 1, ...args, row.fixture_id, row.fixture_id, row.fixture_id),
    db.prepare(`UPDATE fixtures SET home_score = ?, away_score = ?, status = 'FINISHED' WHERE id = ? AND ${gate}`)
      .bind(data.home, data.away, row.fixture_id, ...args),
    ...data.scorers.map((id) => db.prepare(`INSERT INTO fixture_scorers (id, fixture_id, player_id)
      SELECT ?, ?, ? WHERE ${gate}`).bind(crypto.randomUUID(), row.fixture_id, String(id), ...args)),
    db.prepare(`INSERT INTO hub_rating_matches (fixture_id) SELECT ? WHERE ${gate}`).bind(row.fixture_id, ...args),
    db.prepare(`WITH eligible(player_id) AS (VALUES ${data.participants.map(() => '(?)').join(',')})
      INSERT INTO hub_rating_players (fixture_id, player_id) SELECT ?, player_id FROM eligible WHERE ${gate}`)
      .bind(...data.participants, row.fixture_id, ...args),
    db.prepare(`WITH calculated AS (
        SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.points') AS points FROM json_each(?)
      ) UPDATE predictions SET points = (SELECT points FROM calculated WHERE calculated.id = predictions.id)
      WHERE fixture_id = ? AND id IN (SELECT id FROM calculated) AND ${gate}`)
      .bind(JSON.stringify(points), row.fixture_id, ...args),
    db.prepare(`UPDATE football_calendar SET finalized_at = ?, last_error = NULL, lease_token = NULL, lease_until = 0
      WHERE season_id = ? AND kgmid = ? AND lease_token = ? AND finalized_at IS NULL`).bind(now, ...args),
  ];
  const results = await db.batch(statements);
  return results.at(-1)?.meta.changes ? null : 'manual_result_requires_review';
}

async function finishDueGame(env: FootballEnv, season: string, now: number) {
  const db = env.DB;
  const token = crypto.randomUUID();
  const row = await db.prepare(`
    UPDATE football_calendar SET lease_token = ?, lease_until = ?
    WHERE (season_id, kgmid) = (
      SELECT season_id, kgmid FROM football_calendar
      WHERE season_id = ? AND fixture_id IS NOT NULL AND finalized_at IS NULL
        AND kickoff_confirmed = 1 AND provider_status NOT IN ('postponed', 'cancelled')
        AND check_after <= ? AND lease_until <= ? AND attempts < ?
      ORDER BY check_after, kgmid LIMIT 1
    ) AND lease_until <= ? RETURNING *
  `).bind(token, now + 2 * minute, season, now, now, retryMinutes.length + 1, now).first<CalendarRow>();
  if (!row) return { imported: false, reason: 'not_due' };
  let error: string | null = null;
  try {
    const { results: players } = await db.prepare("SELECT id, name, position FROM players WHERE team_id = 'fcp'").all<RosterPlayer>();
    // A valid finished snapshot survives a DB failure and is reused without another paid search.
    const game = row.final_json ? JSON.parse(row.final_json) as PortoGame
      : await getPortoGame(env.SERPAPI_API_KEY!.trim(), row.kgmid, players, { fresh: true });
    const original = JSON.parse(row.calendar_json) as PortoCalendarGame;
    if (game.fixture.teams.some((team, index) => team.kgmid !== original.teams[index].kgmid)) {
      error = 'fixture_identity_changed';
    } else {
      const data = finalData(game);
      if ('error' in data) error = data.error;
      else {
        await db.prepare('UPDATE football_calendar SET final_json = ? WHERE season_id = ? AND kgmid = ? AND lease_token = ?')
          .bind(JSON.stringify(game), season, row.kgmid, token).run();
        error = await publishFinal(db, row, game, players, token, now);
      }
    }
    if (!error) return { imported: true, fixtureId: row.fixture_id };
  } catch (caught) {
    error = caught instanceof SerpApiError ? caught.code : 'import_failed';
  }
  const permanent = ['manual_result_requires_review', 'fixture_identity_changed'].includes(error ?? '');
  const attempt = permanent ? retryMinutes.length + 1 : row.attempts + 1;
  await db.prepare(`UPDATE football_calendar SET attempts = ?, check_after = ?, last_error = ?, lease_token = NULL, lease_until = 0
    WHERE season_id = ? AND kgmid = ? AND lease_token = ?`)
    .bind(attempt, now + (retryMinutes[attempt - 1] ?? 24 * 60) * minute, error, season, row.kgmid, token).run();
  return { imported: false, reason: error };
}

export async function runFootballAutomation(env: FootballEnv, now = Date.now()) {
  // This guard precedes every DB access: deploying code cannot enable automatic writes.
  if (env.FOOTBALL_AUTOMATION_ENABLED !== 'true') return { enabled: false };
  if (!env.SERPAPI_API_KEY?.trim()) return { enabled: true, error: 'missing_key' };
  const season = await getActiveSeasonId(env.DB);
  // Provider failures must not prevent already stored games from opening or finishing.
  let calendarError: string | null = null;
  try { await refreshFootballCalendar(env, now); }
  catch (error) { calendarError = error instanceof SerpApiError ? error.code : 'calendar_refresh_failed'; }
  const { results: rows } = await env.DB.prepare('SELECT * FROM football_calendar WHERE season_id = ? AND finalized_at IS NULL')
    .bind(season).all<CalendarRow>();
  await syncStoredFixtureTimes(env.DB, rows);
  let opened = 0;
  for (const row of selectedGames(rows, now)) if (await openGame(env.DB, row)) opened++;
  const final = await finishDueGame(env, season, now);
  return { enabled: true, opened, final, calendarError };
}
