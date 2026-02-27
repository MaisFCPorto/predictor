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

// Create a new product
products.post('/', async (c) => {
  try {
    const { name, description, price, stock, image_url, category } = await c.req.json();
    
    if (!name || !price || stock === undefined) {
      return c.json({ error: 'missing required fields' }, 400);
    }

    const shopService = new ShopSupabaseService(c.env);
    const product = await shopService.createProduct({
      id: crypto.randomUUID(),
      name,
      description: description || '',
      price,
      stock,
      image_url: image_url || '',
      category: category || 'general',
    });

    return c.json(product);
  } catch (error) {
    console.error('Product creation error:', error);
    return c.json({ error: 'product creation failed' }, 500);
  }
});

// Update a product
products.put('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const updates = await c.req.json();

    const shopService = new ShopSupabaseService(c.env);
    const product = await shopService.updateProduct(id, updates);

    return c.json(product);
  } catch (error) {
    console.error('Product update error:', error);
    return c.json({ error: 'product update failed' }, 500);
  }
});

// Delete a product
products.delete('/:id', async (c) => {
  try {
    const { id } = c.req.param();

    const shopService = new ShopSupabaseService(c.env);
    await shopService.deleteProduct(id);

    return c.json({ success: true });
  } catch (error) {
    console.error('Product deletion error:', error);
    return c.json({ error: 'product deletion failed' }, 500);
  }
});
