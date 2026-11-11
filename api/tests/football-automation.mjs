import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setup, start, kickoff, gameId, cupId, minute, day, finishedFixture, calendar } from './support.mjs';

async function scenario(name, run, options) {
  const env = await setup(options);
  try { await run(env); console.log('PASS ' + name); }
  finally { await env.worker.dispose(); }
}
const idFor = (kgmid) => 'auto-' + createHash('sha256').update('test-season\0' + kgmid).digest('hex').slice(0, 32);
const fixtureId = idFor(gameId);
const count = async (db, table) => (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n;

function novemberCalendar() {
  const template = calendar().team_results.games[0];
  const porto = template.teams.find((team) => team.kgmid === '/m/0177gl');
  const fixture = (kgmid, when, league, opponent, home = true) => ({
    ...structuredClone(template), kgmid, start_time: when, league,
    teams: home ? [structuredClone(porto), opponent] : [opponent, structuredClone(porto)],
  });
  return { team_results: { games: [
    fixture('/g/11z_0fwl22', '2026-11-20T20:45:00Z', { kgmid: '/m/03qdvf', name: 'Taça de Portugal' },
      { kgmid: '/g/121b6wjl', name: 'União Sport Clube Paredes' }),
    fixture('/g/11nvlsdd0q', '2026-11-24T20:00:00Z', { kgmid: '/m/0c1q0', name: 'UEFA Champions League' },
      { kgmid: '/m/0cttx', name: 'Feyenoord' }, false),
    fixture('/g/11nqx_y6yr', '2026-11-29T20:30:00Z', { kgmid: '/m/03n_lr', name: 'Liga Portugal' },
      { kgmid: '/m/03b04g', name: 'Sporting CP' }),
  ] } };
}
async function linkChampions(db) {
  await db.batch([
    db.prepare("INSERT INTO competitions (id, code, name) VALUES ('LC', 'LC', 'Liga dos Campeões')"),
    db.prepare("INSERT INTO football_competition_links (kgmid, competition_id) VALUES ('/m/0c1q0', 'LC')"),
  ]);
}

await scenario('disabled automation does not even require the new tables', async ({ tick, calls }) => {
  assert.equal((await tick()).status, 200);
  assert.equal(calls.length, 0);
}, { disabled: true, noSchema: true });

const november = novemberCalendar();
await scenario('20 Nov cup and 24 Nov Champions open first; 29 Nov league follows the imported cup', async ({ db, tick, calls, request, hubHeaders, provider }) => {
  await linkChampions(db);
  const [cup, champions, league] = november.team_results.games;
  const cupKickoff = Date.parse(cup.start_time);
  const initial = cupKickoff - day;
  await tick(initial);
  const opened = await request('/api/fixtures/open', { now: initial });
  assert.deepEqual(opened.body.map((fx) => fx.id), [idFor(cup.kgmid), idFor(champions.kgmid)]);
  assert.equal((await request('/api/internal/hub-fans/plantel', { now: initial, headers: hubHeaders })).body.next.id, idFor(cup.kgmid));
  assert.equal((await db.prepare('SELECT fixture_id FROM football_calendar WHERE kgmid = ?').bind(league.kgmid).first()).fixture_id, null);
  provider((id) => {
    assert.equal(id, cup.kgmid);
    const data = finishedFixture(id);
    const porto = data.game_results.info.teams[1];
    data.game_results.info = { ...structuredClone(cup), status: 'finished', status_original: 'FT',
      teams: [porto, { ...cup.teams[1], score: 1 }] };
    data.game_results.lineups.teams.forEach((team) => { team.team_index = 1 - team.team_index; });
    data.game_results.timeline.events.forEach((event) => {
      if (event.team_index === 0 || event.team_index === 1) event.team_index = 1 - event.team_index;
    });
    return data;
  });
  await tick(cupKickoff + 119 * minute);
  assert.equal(await count(db, 'fixtures'), 2, 'The next pair must wait for the running cup game');
  await tick(cupKickoff + 120 * minute);
  assert.deepEqual(await db.prepare('SELECT status, home_score, away_score FROM fixtures WHERE id = ?')
    .bind(idFor(cup.kgmid)).first(), { status: 'FINISHED', home_score: 2, away_score: 1 });
  const ballot = await request('/api/internal/hub-fans/notas?jogo=' + idFor(cup.kgmid), {
    now: cupKickoff + 120 * minute, headers: hubHeaders,
  });
  assert.equal(ballot.status, 200);
  assert.equal(ballot.body.eligible.length, 18);
  await tick(cupKickoff + 125 * minute);
  const following = await request('/api/fixtures/open', { now: cupKickoff + 125 * minute });
  assert.deepEqual(following.body.map((fx) => fx.id), [idFor(champions.kgmid), idFor(league.kgmid)]);
  assert.equal((await request('/api/internal/hub-fans/plantel', {
    now: cupKickoff + 125 * minute, headers: hubHeaders,
  })).body.next.id, idFor(champions.kgmid));
  await tick(cupKickoff + 130 * minute);
  assert.equal(await count(db, 'fixtures'), 3);
  assert.deepEqual(calls.map((call) => call.type), ['team', 'game'], 'Advancing the pair must reuse the stored calendar');
}, { calendar: november });

const crowded = novemberCalendar();
crowded.team_results.games[2].start_time = '2026-11-25T20:30:00Z';
crowded.team_results.games.reverse();
await scenario('only the first two games open even when three competitions fit within seven days', async ({ db, tick, request }) => {
  await linkChampions(db);
  await tick();
  const opened = await request('/api/fixtures/open');
  assert.deepEqual(opened.body.map((fx) => fx.id), [idFor('/g/11z_0fwl22'), idFor('/g/11nvlsdd0q')]);
  assert.equal((await db.prepare("SELECT fixture_id FROM football_calendar WHERE kgmid = '/g/11nqx_y6yr'").first()).fixture_id, null);
}, { calendar: crowded });

for (const [label, interval, together] of [
  ['less than seven days', 7 * day - minute, true],
  ['exactly seven days', 7 * day, false],
]) {
  const data = calendar();
  data.team_results.games = data.team_results.games.slice(0, 2);
  data.team_results.games[1].start_time = new Date(kickoff + interval).toISOString();
  await scenario('the second game is ' + label + ' after the first', async ({ tick, request, calls }) => {
    await tick();
    const opened = await request('/api/fixtures/open');
    assert.deepEqual(opened.body.map((fx) => fx.id), together ? [fixtureId, idFor(cupId)] : [fixtureId]);
    assert.equal(calls.length, 1);
  }, { calendar: data });
}

await scenario('complete lifecycle: Predictor, Onze, scores, scorers, points and Notas', async ({ db, tick, calls, request, hubHeaders }) => {
  // A manual fixture is a sentinel: automation must not modify it.
  await db.prepare(`INSERT INTO fixtures (id, matchday_id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score)
    VALUES ('manual-sentinel', 'test-md', 'fcp', 'test-opponent', '2026-11-01T18:00:00Z', 'FINISHED', 4, 0)`).run();
  const manualBefore = await db.prepare("SELECT * FROM fixtures WHERE id = 'manual-sentinel'").first();
  assert.equal((await tick()).status, 200);
  assert.equal(calls.length, 1, 'All five calendar fixtures use one search');
  assert.equal(await count(db, 'football_calendar'), 5);
  const tbd = await db.prepare("SELECT * FROM football_calendar WHERE kgmid = '/g/test_tbd'").first();
  assert.equal(tbd.kickoff_confirmed, 0);
  assert.equal(tbd.kickoff_at, null);
  assert.equal(tbd.kickoff_date, '2026-11-16');
  assert.equal(tbd.fixture_id, null);

  const opened = await request('/api/fixtures/open');
  assert.equal(opened.status, 200);
  assert.deepEqual(opened.body.map((fx) => fx.id), [fixtureId, idFor(cupId)]);
  assert.ok(opened.body.every((fx) => /^[a-z0-9-]+$/.test(fx.id)), 'IDs must be safe in existing fixture URLs');
  assert.equal(opened.body[0].is_locked, false);
  const onze = await request('/api/internal/hub-fans/plantel', { headers: hubHeaders });
  assert.equal(onze.status, 200);
  assert.equal(onze.body.next.id, fixtureId);
  assert.equal(onze.body.players.length, 41);

  const prediction = { fixtureId, userId: 'test-user', home: 1, away: 2, scorer_player_id: 11 };
  assert.equal((await request('/api/predictions', { method: 'POST', body: prediction })).status, 200);
  const boundary = await request('/api/fixtures/open', { now: kickoff });
  assert.equal(boundary.body.find((fx) => fx.id === fixtureId).is_locked, true);
  const locked = await request('/api/predictions', { now: kickoff, method: 'POST', body: { ...prediction, home: 9 } });
  assert.equal(locked.status, 400);
  assert.equal(locked.body.error, 'locked');
  await tick(kickoff + 119 * minute);
  assert.equal(calls.length, 1, 'No daily or in-game detail polling');
  assert.equal((await tick(kickoff + 120 * minute)).status, 200);
  assert.equal(calls.length, 2, 'Exactly one calendar search plus one complete final search');
  assert.deepEqual(calls.map((call) => call.type), ['team', 'game']);

  const finished = await db.prepare('SELECT status, home_score, away_score FROM fixtures WHERE id = ?').bind(fixtureId).first();
  assert.deepEqual(finished, { status: 'FINISHED', home_score: 1, away_score: 2 });
  const { results: scorers } = await db.prepare('SELECT player_id FROM fixture_scorers WHERE fixture_id = ? ORDER BY CAST(player_id AS INTEGER)').bind(fixtureId).all();
  assert.deepEqual(scorers.map((row) => row.player_id), ['11', '20']);
  assert.equal((await db.prepare("SELECT points FROM predictions WHERE user_id = 'test-user'").first()).points, 15);

  const ballot = await request('/api/internal/hub-fans/notas?jogo=' + encodeURIComponent(fixtureId), { now: kickoff + 120 * minute, headers: hubHeaders });
  assert.equal(ballot.status, 200);
  assert.equal(ballot.body.eligible.length, 18);
  assert.equal(ballot.body.eligible.some((p) => p.id === 2), false, 'Unused bench players cannot receive ratings');
  const snapshot = JSON.parse((await db.prepare('SELECT final_json FROM football_calendar WHERE kgmid = ?').bind(gameId).first()).final_json);
  assert.equal(snapshot.porto.starters.length, 11);
  assert.equal(snapshot.porto.substitutions.length, 7);
  const rated = await request('/api/internal/hub-fans/notas?jogo=' + encodeURIComponent(fixtureId), {
    now: kickoff + 120 * minute, headers: hubHeaders, method: 'PUT',
    body: { ratings: ballot.body.eligible.map((p) => ({ playerId: p.id, rating: 7 })) },
  });
  assert.equal(rated.status, 200);
  const unused = await request('/api/internal/hub-fans/notas?jogo=' + encodeURIComponent(fixtureId), {
    headers: hubHeaders, method: 'PUT', body: { ratings: [{ playerId: 2, rating: 10 }] },
  });
  assert.equal(unused.status, 400);
  await tick(kickoff + 125 * minute);
  assert.equal(calls.length, 2);
  assert.equal(await count(db, 'hub_player_ratings'), 18);
  assert.equal(await count(db, 'fixture_scorers'), 2);
  const nextOnze = await request('/api/internal/hub-fans/plantel', { now: kickoff + 125 * minute, headers: hubHeaders });
  assert.equal(nextOnze.body.next.id, idFor(cupId));
  assert.deepEqual(await db.prepare("SELECT * FROM fixtures WHERE id = 'manual-sentinel'").first(), manualBefore);
});

await scenario('live or incomplete results wait and retry without publishing partial data', async ({ db, tick, calls, provider }) => {
  await tick();
  provider((id) => { const data = finishedFixture(id); data.game_results.info.status = 'live'; return data; });
  await tick(kickoff + 120 * minute);
  assert.equal((await db.prepare('SELECT status FROM fixtures WHERE id = ?').bind(fixtureId).first()).status, 'SCHEDULED');
  assert.equal(await count(db, 'hub_rating_matches'), 0);
  await tick(kickoff + 134 * minute);
  assert.equal(calls.length, 2);
  provider((id) => { const data = finishedFixture(id); delete data.game_results.lineups; return data; });
  await tick(kickoff + 135 * minute);
  assert.equal(await count(db, 'fixture_scorers'), 0);
  provider(finishedFixture);
  await tick(kickoff + 164 * minute);
  assert.equal(calls.length, 3);
  await tick(kickoff + 165 * minute);
  assert.equal(calls.length, 4);
  assert.equal((await db.prepare('SELECT status FROM fixtures WHERE id = ?').bind(fixtureId).first()).status, 'FINISHED');
});

await scenario('a DB failure rolls back result, scorers, points and ratings; retry reuses saved data', async ({ db, tick, calls }) => {
  await tick();
  await db.exec("CREATE TRIGGER rehearsal_failure BEFORE INSERT ON hub_rating_players BEGIN SELECT RAISE(ABORT, 'rehearsal_failure'); END;");
  await tick(kickoff + 120 * minute);
  const failed = await db.prepare('SELECT status, home_score, away_score FROM fixtures WHERE id = ?').bind(fixtureId).first();
  assert.deepEqual(failed, { status: 'SCHEDULED', home_score: null, away_score: null });
  assert.equal(await count(db, 'hub_rating_matches'), 0);
  assert.equal(await count(db, 'fixture_scorers'), 0);
  assert.equal(calls.length, 2);
  await db.exec('DROP TRIGGER rehearsal_failure');
  await tick(kickoff + 135 * minute);
  assert.equal(calls.length, 2, 'A database retry must not spend another provider search');
  assert.equal((await db.prepare('SELECT status FROM fixtures WHERE id = ?').bind(fixtureId).first()).status, 'FINISHED');
});

await scenario('overlapping cron invocations make one final request and one import', async ({ db, tick, calls }) => {
  await Promise.all([tick(), tick()]);
  assert.equal(calls.length, 1);
  assert.equal(await count(db, 'football_calendar'), 5);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM football_calendar WHERE last_error IS NOT NULL').first()).n, 0);
  await Promise.all([tick(kickoff + 120 * minute), tick(kickoff + 120 * minute)]);
  assert.equal(calls.length, 2);
  assert.equal(await count(db, 'fixture_scorers'), 2);
  assert.equal(await count(db, 'hub_rating_players'), 18);
});

await scenario('unmatched players stay pending and own goals give no scorer bonus', async ({ db, tick, calls, provider }) => {
  await tick();
  provider((id) => { const data = finishedFixture(id); data.game_results.lineups.teams[0].starters[0].name = 'Jogador desconhecido'; return data; });
  await tick(kickoff + 120 * minute);
  assert.equal(await count(db, 'fixture_scorers'), 0);
  assert.equal((await db.prepare('SELECT last_error FROM football_calendar WHERE kgmid = ?').bind(gameId).first()).last_error, 'unmatched_player');
  provider((id) => {
    const data = finishedFixture(id);
    data.game_results.info.teams[1].goal_summary[0] = {
      player: { name: 'Adversário sem ID' }, goals: [{ in_game_time: { minute: 38 }, extensions: ['OG'] }],
    };
    return data;
  });
  await tick(kickoff + 135 * minute);
  assert.equal(await count(db, 'fixture_scorers'), 1);
  assert.equal((await db.prepare('SELECT player_id FROM fixture_scorers').first()).player_id, '11');
  assert.equal(calls.length, 3);
});

await scenario('the configured advance lock is preserved', async ({ tick, request }) => {
  await tick();
  const prediction = { fixtureId, userId: 'test-user', home: 1, away: 2, scorer_player_id: 11 };
  assert.equal((await request('/api/predictions', { now: kickoff - 11 * minute, method: 'POST', body: prediction })).status, 200);
  const locked = await request('/api/predictions', { now: kickoff - 10 * minute, method: 'POST', body: prediction });
  assert.equal(locked.status, 400);
  assert.equal(locked.body.error, 'locked');
}, { lockMinutes: 10 });

await scenario('a confirmed time change and postponement update only the owned fixture', async ({ db, tick, request, hubHeaders }) => {
  await tick();
  const moved = new Date(kickoff + 2 * 60 * minute).toISOString();
  await db.prepare('UPDATE football_calendar SET kickoff_at = ? WHERE kgmid = ?').bind(moved, gameId).run();
  await tick(start + 5 * minute);
  assert.equal((await db.prepare('SELECT kickoff_at FROM fixtures WHERE id = ?').bind(fixtureId).first()).kickoff_at, moved);
  const next = await request('/api/internal/hub-fans/plantel', { headers: hubHeaders });
  assert.equal(Date.parse(next.body.next.kickoffAt), Date.parse(moved));
  await db.prepare("UPDATE football_calendar SET provider_status = 'postponed' WHERE kgmid = ?").bind(gameId).run();
  await tick(start + 10 * minute);
  assert.equal((await db.prepare('SELECT status FROM fixtures WHERE id = ?').bind(fixtureId).first()).status, 'POSTPONED');
  assert.equal((await request('/api/predictions', { method: 'POST', body: { fixtureId, userId: 'test-user', home: 1, away: 2 } })).body.error, 'locked');
  await db.prepare("UPDATE football_calendar SET provider_status = 'upcoming' WHERE kgmid = ?").bind(gameId).run();
  await tick(start + 15 * minute);
  assert.equal((await db.prepare('SELECT status FROM fixtures WHERE id = ?').bind(fixtureId).first()).status, 'SCHEDULED');
});

await scenario('all prediction points publish in one transaction for 1000 users', async ({ db, tick, calls }) => {
  await tick();
  await db.batch([
    db.prepare(`WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i + 1 FROM n WHERE i < 1000)
      INSERT INTO users (id, email) SELECT 'bulk-' || i, 'bulk-' || i || '@example.invalid' FROM n`),
    db.prepare(`INSERT INTO predictions (id, user_id, fixture_id, home_goals, away_goals, scorer_player_id)
      SELECT id, id, ?, 1, 2, '11' FROM users WHERE id LIKE 'bulk-%'`).bind(fixtureId),
  ]);
  await tick(kickoff + 120 * minute);
  const points = await db.prepare('SELECT COUNT(*) AS n, MIN(points) AS min, MAX(points) AS max FROM predictions').first();
  assert.deepEqual(points, { n: 1000, min: 15, max: 15 });
  assert.equal(calls.length, 2);
});

await scenario('ambiguous opponents are recorded without creating a wrong game', async ({ db, tick, calls }) => {
  await db.prepare("INSERT INTO teams (id, name) VALUES ('ambiguous-opponent', 'Vitoria SC')").run();
  await tick();
  assert.equal(await count(db, 'fixtures'), 0);
  assert.equal((await db.prepare('SELECT last_error FROM football_calendar WHERE kgmid = ?').bind(gameId).first()).last_error, 'unmatched_team');
  assert.equal(calls.length, 1);
});

await scenario('no daily calendar polling, with refresh after 72 hours for unconfirmed times', async ({ tick, calls }) => {
  await tick();
  await tick(start + day);
  assert.equal(calls.filter((call) => call.type === 'team').length, 1);
  await tick(start + 3 * day);
  assert.equal(calls.filter((call) => call.type === 'team').length, 2);
});

await scenario('existing manual game is neither duplicated nor adopted', async ({ db, tick, calls }) => {
  await db.prepare(`INSERT INTO fixtures (id, matchday_id, home_team_id, away_team_id, competition_id, kickoff_at, status)
    VALUES ('manual-game', 'test-md', 'test-opponent', 'fcp', 'LP', ?, 'SCHEDULED')`).bind(new Date(kickoff).toISOString()).run();
  await tick();
  const row = await db.prepare('SELECT fixture_id, last_error FROM football_calendar WHERE kgmid = ?').bind(gameId).first();
  assert.deepEqual(row, { fixture_id: null, last_error: 'existing_fixture_requires_link' });
  await tick(kickoff + 120 * minute);
  assert.equal(calls.length, 1);
  assert.equal((await db.prepare("SELECT status FROM fixtures WHERE id = 'manual-game'").first()).status, 'SCHEDULED');
});

await scenario('the manual result and scorer flow keeps its existing points formula', async ({ db, request }) => {
  await db.batch([
    db.prepare(`INSERT INTO fixtures (id, matchday_id, home_team_id, away_team_id, competition_id, kickoff_at)
      VALUES ('manual-result', 'test-md', 'test-opponent', 'fcp', 'LP', '2026-11-01T18:00:00Z')`),
    db.prepare("INSERT INTO fixture_scorers (id, fixture_id, player_id) VALUES ('manual-scorer', 'manual-result', '11')"),
    db.prepare(`INSERT INTO predictions (id, user_id, fixture_id, home_goals, away_goals, scorer_player_id, booster_used)
      VALUES ('manual-prediction', 'test-user', 'manual-result', 1, 2, '11', 1)`),
  ]);
  const result = await request('/api/admin/fixtures/manual-result/result', { method: 'PATCH', body: { home_score: 1, away_score: 2 } });
  assert.equal(result.status, 200);
  assert.deepEqual(await db.prepare("SELECT points, booster_used FROM predictions WHERE id = 'manual-prediction'").first(), { points: 15, booster_used: 1 });
});

await scenario('0-0 with no substitutions still opens the eleven eligible players', async ({ db, tick, provider }) => {
  await tick();
  provider((id) => {
    const data = finishedFixture(id);
    data.game_results.info.teams.forEach((team) => { team.score = 0; delete team.goal_summary; });
    data.game_results.lineups.teams[0].bench = [{ name: 'Suplente não utilizado' }];
    data.game_results.timeline.events = [];
    return data;
  });
  await tick(kickoff + 120 * minute);
  assert.deepEqual(await db.prepare('SELECT home_score, away_score FROM fixtures WHERE id = ?').bind(fixtureId).first(), { home_score: 0, away_score: 0 });
  assert.equal(await count(db, 'fixture_scorers'), 0);
  assert.equal(await count(db, 'hub_rating_players'), 11);
});

console.log('\nEnsaio concluído: bases D1 locais descartáveis, sem chamadas reais à SerpApi e sem dados de produção.');
