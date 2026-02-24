import { Hono } from 'hono';
import { Env } from '../../types';
import { nanoid } from 'nanoid';
import { requireAdminKey } from '../admin';
import { jwtVerify } from 'jose';
import { createRemoteJWKSet } from 'jose';

export const orders = new Hono<{ Bindings: Env }>();

// Create a new order
orders.post('/', async (c) => {
  const { items, total, shipping } = await c.req.json();
  if (!items?.length || !total || !shipping) {
    return c.json({ error: 'missing required fields' }, 400);
  }

  // Get user from auth token
  const authz = c.req.header('Authorization') || '';
  const token = authz.replace(/^Bearer\s+/i, '');
  if (!token) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  try {
    const jwksUrl = new URL('/auth/v1/keys', c.env.SUPABASE_URL).toString();
    const JWKS = createRemoteJWKSet(new URL(jwksUrl));
    const { payload } = await jwtVerify(token, JWKS);
    const userId = String(payload.sub || '');
    if (!userId) {
      return c.json({ error: 'invalid token' }, 401);
    }

    // Create order
    const orderId = nanoid();
    await c.env.DB
      .prepare(`
        INSERT INTO shop_orders (
          id, user_id, status, total,
          shipping_address, shipping_city, shipping_postal_code, shipping_country
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        orderId,
        userId,
        'pending',
        total,
        shipping.address,
        shipping.city,
        shipping.postalCode,
        shipping.country,
      )
      .run();

    // Create order items
    for (const item of items) {
      await c.env.DB
        .prepare(`
          INSERT INTO shop_order_items (
            id, order_id, product_id, quantity, price
          ) VALUES (?, ?, ?, ?, ?)
        `)
        .bind(nanoid(), orderId, item.id, item.quantity, item.price)
        .run();

      // Update product stock
      await c.env.DB
        .prepare('UPDATE shop_products SET stock = stock - ? WHERE id = ?')
        .bind(item.quantity, item.id)
        .run();
    }

    return c.json({ id: orderId });
  } catch (error) {
    console.error('Order creation error:', error);
    return c.json({ error: 'order creation failed' }, 500);
  }
});

// Get order details (admin only)
orders.get('/:id', requireAdminKey, async (c) => {
  const { id } = c.req.param();

  const { results: orders } = await c.env.DB
    .prepare('SELECT * FROM shop_orders WHERE id = ?')
    .bind(id)
    .all();

  const order = orders[0];
  if (!order) {
    return c.json({ error: 'order not found' }, 404);
  }

  const { results: items } = await c.env.DB
    .prepare(`
      SELECT oi.*, p.name, p.image_url
      FROM shop_order_items oi
      LEFT JOIN shop_products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `)
    .bind(id)
    .all();

  const { results: payments } = await c.env.DB
    .prepare('SELECT * FROM shop_payments WHERE order_id = ?')
    .bind(id)
    .all();

  return c.json({
    ...order,
    items,
    payments,
  });
});

// List orders (admin only)
orders.get('/', requireAdminKey, async (c) => {
  const { results } = await c.env.DB
    .prepare(`
      SELECT o.*, COUNT(oi.id) as item_count, 
             (SELECT status FROM shop_payments WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1) as payment_status
      FROM shop_orders o
      LEFT JOIN shop_order_items oi ON oi.order_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `)
    .all();

  return c.json(results);
});

// Update order status (admin only)
orders.patch('/:id', requireAdminKey, async (c) => {
  const { id } = c.req.param();
  const { status } = await c.req.json();
  if (!status) {
    return c.json({ error: 'missing status' }, 400);
  }

  await c.env.DB
    .prepare('UPDATE shop_orders SET status = ? WHERE id = ?')
    .bind(status, id)
    .run();

  return c.json({ success: true });
});
