// apps/api/src/cors.ts
import type { Context, Next } from 'hono';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://maispredictor.vercel.app',
];

export function corsHeaders(origin?: string) {
  const allowOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':
      'Authorization, Content-Type, X-Admin-Key',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    // opcional mas útil quando a resposta é 204
    'Vary': 'Origin',
  };
}

export async function corsMiddleware(c: Context, next: Next) {
  const origin = c.req.header('Origin') || undefined;

  // Preflight
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204, corsHeaders(origin));
  }

  await next();

  // Anexa CORS na resposta normal
  const headers = corsHeaders(origin);
  for (const [k, v] of Object.entries(headers)) {
    c.header(k, v);
  }
}
