import { Hono } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';

type Env = {
  DB: D1Database;
  SUPABASE_URL: string; // define no wrangler.toml [vars]
};

// CORS básico (se já tens um util, usa o teu)
function cors(o?: string) {
  return {
    'access-control-allow-origin': o ?? '*',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type, X-Admin-Key',
    'access-control-allow-credentials': 'true',
  };
}

export const auth = new Hono<{ Bindings: Env }>();

auth.options('*', (c) => c.body(null, 204, cors(c.req.header('Origin') || undefined)));

auth.get('/me', async (c) => {
  const origin = c.req.header('Origin') || undefined;
  const headers = cors(origin);

  const authz = c.req.header('Authorization') || '';
  const token = authz.replace(/^Bearer\s+/i, '');
  if (!token) return c.json({ error: 'missing token' }, 401, headers);

  try {
    const jwksUrl = new URL('/auth/v1/keys', c.env.SUPABASE_URL).toString();
    const JWKS = createRemoteJWKSet(new URL(jwksUrl));

    const { payload } = await jwtVerify(token, JWKS);
    const userId = String(payload.sub || '');
    if (!userId) return c.json({ error: 'invalid token' }, 401, headers);

    // Lê o role da tua D1 (ajusta a tabela/coluna!)
    const { results } = await c.env.DB
      .prepare('SELECT role FROM users WHERE id = ? LIMIT 1')
      .bind(userId)
      .all<{ role: string }>();

    const role = results?.[0]?.role || 'user';
    return c.json({ id: userId, role }, 200, headers);
  } catch (e) {
    return c.json({ error: 'invalid token' }, 401, headers);
  }
});
