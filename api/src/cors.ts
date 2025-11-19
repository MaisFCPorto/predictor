// predictor-porto/api/src/cors.ts
import type { MiddlewareHandler } from 'hono';

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  // Usa SEMPRE o Origin do pedido, ou '*' se não houver
  const origin = c.req.header('Origin') ?? '*';
  const reqHeaders =
    c.req.header('Access-Control-Request-Headers') ?? '*';

  c.header('Access-Control-Allow-Origin', origin);
  // Para caches não baralharem diferentes origins
  c.header('Vary', 'Origin');

  c.header(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  );
  c.header('Access-Control-Allow-Headers', reqHeaders);
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Max-Age', '86400');

  // Responder logo aos preflights
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  await next();
};
