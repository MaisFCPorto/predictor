// Local workerd entry only. Never deploy this module to Cloudflare.
import app from '../src/index';
import { FOOTBALL_CRON, type FootballEnv } from '../src/football-automation';

let clock = Date.now();
Date.now = () => clock;
console.info = () => {};
type Env = FootballEnv & { ADMIN_KEY: string; SUPABASE_URL: string; HUB_NEWS_KEY: string };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const requested = request.headers.get('x-rehearsal-now');
    if (requested) clock = Number(requested);
    if (new URL(request.url).pathname === '/__rehearsal/tick') {
      await app.scheduled({ cron: FOOTBALL_CRON, scheduledTime: clock, noRetry() {} }, env);
      return Response.json({ ok: true });
    }
    return app.fetch(request, env, ctx);
  },
};
