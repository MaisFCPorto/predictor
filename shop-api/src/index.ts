import { Hono } from 'hono';
import { corsMiddleware } from './cors';
import { orders } from './routes/shop/orders';
import { payments } from './routes/shop/payments';
import { products } from './routes/shop/products';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Apply CORS to all routes
app.use('*', corsMiddleware);

// Shop routes (with and without /api prefix for compatibility)
app.route('/shop/orders', orders);
app.route('/shop/payments', payments);
app.route('/shop/products', products);

// Also support /api prefix for production compatibility
app.route('/api/shop/orders', orders);
app.route('/api/shop/payments', payments);
app.route('/api/shop/products', products);

// Health check
app.get('/', (c: any) => {
  return c.json({ 
    message: 'Predictor Shop API',
    version: '1.0.0',
    endpoints: [
      '/shop/orders',
      '/shop/payments',
      '/shop/products'
    ]
  });
});

import { checkPendingPayments } from './cron';

export default {
  fetch: app.fetch,
  
  // Scheduled cron job to check pending payments
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(checkPendingPayments(env));
  },
};
