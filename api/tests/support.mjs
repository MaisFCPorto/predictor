import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare, Log, LogLevel } from 'miniflare';

const root = new URL('../', import.meta.url);
const minute = 60_000;
const day = 24 * 60 * minute;
const start = Date.parse('2026-11-11T15:00:00Z');
const kickoff = start + 3 * 60 * minute;
const gameId = '/g/test_league';
const cupId = '/g/test_cup';
const players = JSON.parse(await readFile(new URL('fixtures/players.json', import.meta.url), 'utf8'));
const savedGame = JSON.parse(await readFile(new URL('fixtures/finished-game.json', import.meta.url), 'utf8'));
const configuredDate = /^compatibility_date\s*=\s*"([^"]+)"/m.exec(await readFile(new URL('wrangler.toml', root), 'utf8'))[1];
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('worker.ts', import.meta.url))],
  bundle: true, format: 'esm', target: 'es2022', platform: 'browser', write: false, logLevel: 'silent',
});

function calendarFixture(id, when, competition = '/m/03n_lr') {
  return {
    ...structuredClone(savedGame.game_results.info), kgmid: id,
    start_time: new Date(when).toISOString(), status: 'upcoming', status_original: 'Scheduled',
    league: competition === '/m/03n_lr' ? { kgmid: competition, name: 'Liga Portugal' }
      : { kgmid: competition, name: 'Taça de Portugal' },
    teams: savedGame.game_results.info.teams.map(({ score, goal_summary, ...team }) => team),
  };
}
function calendar() {
  const undated = calendarFixture('/g/test_tbd', kickoff + 5 * day);
  delete undated.start_time;
  undated.start_date = '2026-11-16T00:00:00Z';
  return { team_results: { games: [
    calendarFixture(gameId, kickoff),
    calendarFixture(cupId, kickoff + 3 * day, '/m/03qdvf'),
    calendarFixture('/g/test_next_league', kickoff + 8 * day),
    calendarFixture('/g/test_seven_days', kickoff + 7 * day, '/m/03qdvf'),
    undated,
  ] } };
}
function finishedFixture(id) {
  const data = structuredClone(savedGame);
  data.game_results.info.kgmid = id;
  data.game_results.info.start_time = new Date(kickoff).toISOString();
  return data;
}

async function setup(options = {}) {
  const calls = [];
  const newsCalls = [];
  const sourceCalls = [];
  let newsProvider = options.newsAI;
  let provider = options.provider ?? ((id) => finishedFixture(id));
  const worker = new Miniflare({
    modules: true, script: bundled.outputFiles[0].text, compatibilityDate: configuredDate,
    log: new Log(LogLevel.ERROR),
    bindings: {
      HUB_NEWS_KEY: 'local-test-hub', SERPAPI_API_KEY: 'local-test-provider',
      FOOTBALL_AUTOMATION_ENABLED: options.disabled ? 'false' : 'true',
      LOCK_MINUTES_BEFORE: String(options.lockMinutes ?? 0),
      ...(options.news ? {
        HUB_NEWS_SUMMARIES_ENABLED: options.newsDisabled ? 'false' : 'true',
        ...(options.newsMissingKey ? {} : { OPENAI_API_KEY: 'local-test-openai' }),
        HUB_NEWS_SUMMARY_DAILY_LIMIT: String(options.newsDailyLimit ?? 30),
        ...(options.newsProxyOrigin ? { HUB_NEWS_FEED_ORIGIN: options.newsProxyOrigin } : {}),
      } : {}),
    },
    // Ephemeral, distinct for each run. No remote D1 binding or Cloudflare credentials.
    d1Databases: { DB: crypto.randomUUID() },
    outboundService: async (request) => {
      const url = new URL(request.url);
      if (options.news && url.origin === 'https://api.openai.com') {
        assert.equal(request.headers.get('Authorization'), 'Bearer local-test-openai');
        assert.equal(url.pathname, '/v1/responses');
        const body = await request.json();
        newsCalls.push(body);
        const response = await newsProvider(body);
        return response instanceof Response ? response : Response.json(response);
      }
      if (options.news && url.origin !== 'https://serpapi.com') {
        sourceCalls.push(url.href);
        const allowed = ['news.google.com', 'www.rtp.pt', 'www.abola.pt', 'www.record.pt', 'maisfutebol.iol.pt', 'www.zerozero.pt', 'maispredictor.app'];
        assert.ok(allowed.includes(url.hostname), 'Only configured news publishers are allowed in news tests');
        return options.newsFeeds ? options.newsFeeds(url, request) : new Response('<rss><channel></channel></rss>', { headers: { 'Content-Type': 'application/rss+xml' } });
      }
      assert.equal(url.origin, 'https://serpapi.com', 'No other outbound service is allowed in the rehearsal');
      assert.equal(url.searchParams.get('api_key'), 'local-test-provider');
      calls.push(Object.fromEntries(url.searchParams));
      if (url.searchParams.get('type') === 'team') return Response.json(options.calendar ?? calendar());
      assert.equal(url.searchParams.get('no_cache'), 'true', 'Post-match imports must not reuse a live cached response');
      const response = await provider(url.searchParams.get('kgmid'));
      return response instanceof Response ? response : Response.json(response);
    },
  });
  const db = await worker.getD1Database('DB');
  const request = async (path, { now = start, method = 'GET', body, headers = {} } = {}) => {
    const response = await worker.dispatchFetch('https://local-test.invalid' + path, {
      method, headers: { 'x-rehearsal-now': String(now), 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  };
  const tick = (now = start) => request('/__rehearsal/tick', { now, method: 'POST' });
  if (!options.noSchema) {
    for (const file of ['migrations/001_init.sql', 'tests/schema.sql', 'migrations/006_scoring_and_indexes.sql',
      'migrations/007_competitions.sql', 'migrations/009_add_players_and_scorers.sql',
      'migrations/013_active_season_settings.sql', 'migrations/016_competition_styles.sql',
      'migrations/019_hub_fan_ratings.sql', 'migrations/020_hub_fan_ratings_zero.sql']) {
      const sql = await readFile(new URL(file, root), 'utf8');
      await db.exec(sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' '));
    }
    if (options.news) for (const file of ['migrations/017_hub_news.sql', 'migrations/018_hub_news_images.sql', 'migrations/023_hub_news_summaries.sql', 'migrations/024_hub_news_context_kind.sql']) {
      await db.exec((await readFile(new URL(file, root), 'utf8')).replace(/--[^\n]*/g, '').replace(/\s+/g, ' '));
    }
    await db.batch([
      db.prepare("INSERT INTO seasons (id, name) VALUES ('test-season', 'Ensaio isolado')"),
      db.prepare("INSERT INTO matchdays (id, season_id, name, starts_at, ends_at) VALUES ('test-md', 'test-season', 'Ensaio', '2026-11-01', '2026-12-01')"),
      db.prepare("UPDATE app_settings SET value = 'test-season' WHERE key = 'active_season_id'"),
      db.prepare("UPDATE app_settings SET value = 'test-md' WHERE key = 'active_matchday_id'"),
      db.prepare("INSERT INTO users (id, email, role) VALUES ('test-admin', 'admin@example.invalid', 'admin')"),
      db.prepare("INSERT INTO users (id, email, role) VALUES ('test-user', 'user@example.invalid', 'user')"),
      db.prepare("INSERT INTO teams (id, name) VALUES ('fcp', 'FC Porto'), ('test-opponent', 'Vitória S.C.')"),
      ...players.map((p) => db.prepare('INSERT INTO players (id, team_id, name, position) VALUES (?, ?, ?, ?)')
        .bind(p.id, p.team_id, p.name, p.position)),
    ]);
    await db.exec((await readFile(new URL('migrations/021_football_automation.sql', root), 'utf8'))
      .replace(/--[^\n]*/g, '').replace(/\s+/g, ' '));
  }
  const hubHeaders = { 'x-hub-news-key': 'local-test-hub', 'x-hub-user-id': 'test-admin' };
  return { worker, db, calls, newsCalls, sourceCalls, request, tick, hubHeaders, provider: (fn) => { provider = fn; }, newsProvider: (fn) => { newsProvider = fn; } };
}


export { setup, start, kickoff, gameId, cupId, minute, day, finishedFixture, calendar };
