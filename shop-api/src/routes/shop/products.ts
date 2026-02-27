import { Hono } from 'hono';
import { Env } from '../../types';
import { ShopSupabaseService } from '../../services/supabase-shop';

export const products = new Hono<{ Bindings: Env }>();

// Handle CORS preflight
products.options('*', (c) => c.body(null, 204));

// List all products
products.get('/', async (c) => {
  try {
    const shopService = new ShopSupabaseService(c.env);
    const products = await shopService.listProducts();
    return c.json(products);
  } catch (error) {
    console.error('Products fetch error:', error);
    return c.json({ error: 'products fetch failed' }, 500);
  }
});
