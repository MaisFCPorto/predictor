import assert from 'node:assert/strict';
import { setup, calendar, start, minute } from './support.mjs';

const opponentKgmid = '/m/048mcq';
const opponentId = 'serp-team-m-048mcq';
const crest = 'https://ssl.gstatic.com/onebox/media/sports/logos/test-opponent.png';
const portoCrest = 'https://ssl.gstatic.com/onebox/media/sports/logos/test-porto.png';

function source() {
  const data = calendar();
  for (const game of data.team_results.games) {
    Object.assign(game.teams[0], { thumbnail: crest, short_code: 'VSC' });
    Object.assign(game.teams[1], { thumbnail: portoCrest, short_code: 'FCP' });
  }
  return data;
}
async function scenario(name, run, data = source()) {
  const env = await setup({ calendar: data });
  try { await run(env, data); console.log('PASS ' + name); }
  finally { await env.worker.dispose(); }
}
const count = async (db, table) => (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n;
async function removeOpponent(db) {
  await db.prepare("DELETE FROM teams WHERE id = 'test-opponent'").run();
}
async function refresh(env) {
  await env.db.prepare('UPDATE football_sync_state SET refresh_after = 0').run();
  await env.tick(start + 5 * minute);
}

await scenario('one calendar call creates missing teams with logos, including a later unopened fixture', async ({ db, tick, calls, request }, data) => {
  await removeOpponent(db);
  Object.assign(data.team_results.games[2].teams[0], { kgmid: '/m/test_future', name: 'Adversário futuro', short_code: 'FUT' });
  assert.equal((await tick()).status, 200);
  assert.equal(calls.length, 1);
  assert.equal(await count(db, 'teams'), 3);
  assert.equal(await count(db, 'football_team_links'), 3);
  assert.deepEqual(await db.prepare('SELECT name, short_name, crest_url FROM teams WHERE id = ?').bind(opponentId).first(),
    { name: 'Vitória S.C.', short_name: 'VSC', crest_url: crest });
  assert.equal((await db.prepare("SELECT crest_url FROM teams WHERE id = 'fcp'").first()).crest_url, portoCrest);
  assert.equal((await db.prepare("SELECT team_id FROM football_team_links WHERE kgmid = '/m/test_future'").first()).team_id, 'serp-team-m-test_future');
  const opened = await request('/api/fixtures/open');
  assert.equal(opened.status, 200);
  assert.equal(opened.body.length, 2);
  assert.ok(opened.body.every((game) => game.home_crest === crest && game.away_crest === portoCrest));
  assert.ok(opened.body.every((game) => game.home_team_name === 'Vitória S.C.'));
});

await scenario('an existing club keeps its ID, chosen name, short name and custom crest', async ({ db, tick }) => {
  await db.prepare("UPDATE teams SET name = 'VITÓRIA S.C.', short_name = 'BO', crest_url = 'https://example.invalid/custom.png' WHERE id = 'test-opponent'").run();
  await tick();
  assert.equal(await count(db, 'teams'), 2);
  assert.equal((await db.prepare('SELECT team_id FROM football_team_links WHERE kgmid = ?').bind(opponentKgmid).first()).team_id, 'test-opponent');
  assert.deepEqual(await db.prepare("SELECT name, short_name, crest_url FROM teams WHERE id = 'test-opponent'").first(),
    { name: 'VITÓRIA S.C.', short_name: 'BO', crest_url: 'https://example.invalid/custom.png' });
});

await scenario('a saved KGMID reuses the same club after provider and backoffice name changes', async (env, data) => {
  await removeOpponent(env.db);
  await env.tick();
  await env.db.prepare('UPDATE teams SET name = ? WHERE id = ?').bind('Nome escolhido no BO', opponentId).run();
  for (const game of data.team_results.games) Object.assign(game.teams[0], { name: 'Nome novo da API', thumbnail: crest + '?v=2' });
  await refresh(env);
  assert.equal(await count(env.db, 'teams'), 2);
  assert.equal((await env.db.prepare('SELECT team_id FROM football_team_links WHERE kgmid = ?').bind(opponentKgmid).first()).team_id, opponentId);
  assert.deepEqual(await env.db.prepare('SELECT name, crest_url FROM teams WHERE id = ?').bind(opponentId).first(),
    { name: 'Nome escolhido no BO', crest_url: crest });
  assert.equal(env.calls.length, 2);
});

await scenario('a missing logo can arrive later without duplicating the club', async (env, data) => {
  await removeOpponent(env.db);
  for (const game of data.team_results.games) delete game.teams[0].thumbnail;
  await env.tick();
  assert.equal((await env.db.prepare('SELECT crest_url FROM teams WHERE id = ?').bind(opponentId).first()).crest_url, null);
  for (const game of data.team_results.games) game.teams[0].thumbnail = crest;
  await refresh(env);
  assert.equal(await count(env.db, 'teams'), 2);
  assert.equal((await env.db.prepare('SELECT crest_url FROM teams WHERE id = ?').bind(opponentId).first()).crest_url, crest);
});

await scenario('invalid and credential-bearing image URLs are ignored while teams can still be created', async ({ db, tick }, data) => {
  await removeOpponent(db);
  const urls = ['javascript:alert(1)', 'http://ssl.gstatic.com/logo.png',
    'https://user:password@ssl.gstatic.com/logo.png', 'https://ssl.gstatic.com/logo.png?api_key=not-a-real-key',
    'https://serpapi.com/searches/test-result/images/crest.png'];
  data.team_results.games.forEach((game, index) => Object.assign(game.teams[0], {
    kgmid: '/g/test_logo_' + index, name: 'Adversário teste ' + index, short_code: 'T' + index, thumbnail: urls[index],
  }));
  await tick();
  assert.equal(await count(db, 'teams'), 6);
  for (let i = 0; i < urls.length; i++) {
    const row = await db.prepare('SELECT crest_url FROM teams WHERE id = ?').bind('serp-team-g-test_logo_' + i).first();
    assert.equal(row.crest_url, i === 4 ? urls[i] : null);
  }
  assert.equal(await count(db, 'fixtures'), 2);
});

await scenario('a team without a stable provider ID stays pending for association', async ({ db, tick }, data) => {
  await removeOpponent(db);
  for (const game of data.team_results.games) delete game.teams[0].kgmid;
  await tick();
  assert.equal(await count(db, 'teams'), 1);
  assert.equal(await count(db, 'fixtures'), 0);
  assert.equal((await db.prepare('SELECT last_error FROM football_calendar LIMIT 1').first()).last_error, 'unmatched_team');
});

await scenario('calendar failure rolls back club creation, links and crest changes together', async (env) => {
  await removeOpponent(env.db);
  await env.db.exec("CREATE TRIGGER reject_calendar BEFORE INSERT ON football_calendar BEGIN SELECT RAISE(ABORT, 'rehearsal_calendar_failure'); END;");
  await env.tick();
  assert.equal(await count(env.db, 'teams'), 1);
  assert.equal(await count(env.db, 'football_team_links'), 1);
  assert.equal(await count(env.db, 'football_calendar'), 0);
  assert.equal((await env.db.prepare("SELECT crest_url FROM teams WHERE id = 'fcp'").first()).crest_url, null);
  await env.db.exec('DROP TRIGGER reject_calendar');
  await refresh(env);
  assert.equal(await count(env.db, 'teams'), 2);
  assert.equal(await count(env.db, 'fixtures'), 2);
});

await scenario('overlapping tasks create just one club and one mapping for each KGMID', async ({ db, tick, calls }) => {
  await removeOpponent(db);
  await Promise.all([tick(), tick()]);
  assert.equal(await count(db, 'teams'), 2);
  assert.equal(await count(db, 'football_team_links'), 2);
  assert.equal(await count(db, 'fixtures'), 2);
  assert.equal(calls.length, 1);
});

await scenario('a shared short code cannot associate two different clubs', async ({ db, tick }, data) => {
  await db.prepare("UPDATE teams SET short_name = 'VSC' WHERE id = 'test-opponent'").run();
  for (const game of data.team_results.games) Object.assign(game.teams[0], {
    kgmid: '/m/test_other_club', name: 'Novo clube com o mesmo código', short_code: 'VSC',
  });
  await tick();
  assert.equal(await count(db, 'teams'), 3);
  assert.equal((await db.prepare("SELECT team_id FROM football_team_links WHERE kgmid = '/m/test_other_club'").first()).team_id,
    'serp-team-m-test_other_club');
  assert.equal((await db.prepare("SELECT name FROM teams WHERE id = 'test-opponent'").first()).name, 'Vitória S.C.');
});

console.log('\nEquipas e logótipos verificados sem pesquisas reais à SerpApi nem pedidos às imagens.');
