import { Hono } from 'hono';
import { corsMiddleware } from './cors';
import { orders } from './routes/shop/orders';
import { payments } from './routes/shop/payments';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Apply CORS to all routes
app.use('*', corsMiddleware);

// Shop routes
app.route('/api/shop/orders', orders);
app.route('/api/shop/payments', payments);

// Health check
app.get('/', (c: any) => {
  return c.json({ 
    message: 'Predictor Shop API',
    version: '1.0.0',
    endpoints: [
      '/api/shop/orders',
      '/api/shop/payments'
    ]
  });
});

export default {
  fetch: app.fetch,
};
