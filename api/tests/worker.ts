// Local workerd entry only. Never deploy this module to Cloudflare.
import app from '../src/index';
import { FOOTBALL_CRON, type FootballEnv } from '../src/football-automation';
import { HUB_NEWS_CRON } from '../src/hub-news';
import { runNewsSummaries, type NewsSummaryEnv } from '../src/hub-news-summaries';

let clock = Date.now();
Date.now = () => clock;
console.info = () => {};
type Env = FootballEnv & NewsSummaryEnv & { ADMIN_KEY: string; SUPABASE_URL: string; HUB_NEWS_KEY: string };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const requested = request.headers.get('x-rehearsal-now');
    if (requested) clock = Number(requested);
    if (new URL(request.url).pathname === '/__rehearsal/tick') {
      await app.scheduled({ cron: FOOTBALL_CRON, scheduledTime: clock, noRetry() {} }, env);
      return Response.json({ ok: true });
    }
    if (new URL(request.url).pathname === '/__rehearsal/news') {
      await app.scheduled({ cron: HUB_NEWS_CRON, scheduledTime: clock, noRetry() {} }, env);
      return Response.json({ ok: true });
    }
    if (new URL(request.url).pathname === '/__rehearsal/summaries') return Response.json(await runNewsSummaries(env, clock));
    return app.fetch(request, env, ctx);
  },
};
