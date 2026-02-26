import { Hono } from 'hono';
import { Env } from '../../types';
import { ShopSupabaseService } from '../../services/supabase-shop';
import { jwtVerify } from 'jose';
import { createRemoteJWKSet } from 'jose';

export const orders = new Hono<{ Bindings: Env }>();

// Handle CORS preflight
orders.options('*', (c) => c.body(null, 204));

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
    console.log('SUPABASE_URL:', c.env.SUPABASE_URL);
    const jwksUrl = new URL('/auth/v1/keys', c.env.SUPABASE_URL).toString();
    console.log('JWKS URL:', jwksUrl);
    const JWKS = createRemoteJWKSet(new URL(jwksUrl));
    const { payload } = await jwtVerify(token, JWKS);
    const userId = String(payload.sub || '');
    if (!userId) {
      return c.json({ error: 'invalid token' }, 401);
    }

    const shopService = new ShopSupabaseService(c.env);
    
    // Create order
    const orderId = crypto.randomUUID();
    await shopService.createOrder({
      id: orderId,
      user_id: userId,
      status: 'pending',
      total,
      shipping_address: shipping.address,
      shipping_city: shipping.city,
      shipping_postal_code: shipping.postalCode,
      shipping_country: shipping.country,
    });

    // Create order items
    const orderItems = items.map((item: any) => ({
      id: crypto.randomUUID(),
      order_id: orderId,
      product_id: item.id,
      quantity: item.quantity,
      price: item.price,
    }));
    await shopService.createOrderItems(orderItems);

    // Update product stock
    for (const item of items) {
      await shopService.updateProductStock(item.id, item.quantity);
    }

    return c.json({ id: orderId });
  } catch (error) {
    console.error('Order creation error:', error);
    return c.json({ error: 'order creation failed' }, 500);
  }
});

// Get order details
orders.get('/:id', async (c) => {
  const { id } = c.req.param();

  try {
    const shopService = new ShopSupabaseService(c.env);
    const order = await shopService.getOrder(id);
    
    if (!order) {
      return c.json({ error: 'order not found' }, 404);
    }

    return c.json(order);
  } catch (error) {
    console.error('Order fetch error:', error);
    return c.json({ error: 'order fetch failed' }, 500);
  }
});

// List orders
orders.get('/', async (c) => {
  try {
    const shopService = new ShopSupabaseService(c.env);
    const orders = await shopService.listOrders();
    
    return c.json(orders);
  } catch (error) {
    console.error('Orders list error:', error);
    return c.json({ error: 'orders list failed' }, 500);
  }
});

// Update order status
orders.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const { status } = await c.req.json();
  if (!status) {
    return c.json({ error: 'missing status' }, 400);
  }

  try {
    const shopService = new ShopSupabaseService(c.env);
    await shopService.updateOrderStatus(id, status);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Order status update error:', error);
    return c.json({ error: 'order status update failed' }, 500);
  }
});
