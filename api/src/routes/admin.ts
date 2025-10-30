// apps/api/src/routes/admin.ts
import { Hono } from 'hono';
type Env = { DB: D1Database };
export const admin = new Hono<{ Bindings: Env }>();

// health
admin.get('/api/admin/health', (c) => c.json({ ok: true }));

// Se já tinhas endpoints reais, copia-os para aqui.
