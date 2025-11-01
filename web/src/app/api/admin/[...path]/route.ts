import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Lê o token da cookie do Supabase (caso o Worker o venha a usar no futuro)
async function readSupabaseAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const supa = jar.getAll().find(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));
  if (!supa?.value) return null;
  try {
    const json = Buffer.from(supa.value.replace(/^base64-/, ''), 'base64').toString('utf8');
    const obj = JSON.parse(json);
    return obj?.access_token ?? null;
  } catch {
    return null;
  }
}

const API = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL; // usa a que tiveres definida
const ADMIN_KEY = process.env.ADMIN_KEY!; // SECRET no Vercel (não pública)

async function proxy(req: NextRequest) {
  if (!API || !ADMIN_KEY) {
    return NextResponse.json(
      { where: 'proxy', error: 'missing API_URL or ADMIN_KEY envs' },
      { status: 500 }
    );
  }

  const path = req.nextUrl.pathname.replace(/^\/api\/admin\//, ''); // e.g. "fixtures"
  const url = `${API}/api/${path}${req.nextUrl.search ?? ''}`;

  // replica método e body
  const init: RequestInit = {
    method: req.method,
    headers: {
      'X-Admin-Key': ADMIN_KEY,
      // passa o Authorization do utilizador se existir (pode ser útil no Worker)
      ...(req.headers.get('authorization') ? { authorization: req.headers.get('authorization')! } : {}),
    },
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await req.arrayBuffer();
    init.body = body;
    // garante content-type se o browser enviou
    const ct = req.headers.get('content-type');
    if (ct) (init.headers as any)['content-type'] = ct;
  }

  // Opcional: se quiseres mesmo enviar o token de Supabase ao Worker
  const access = await readSupabaseAccessToken();
  if (access && !(init.headers as any).authorization) {
    (init.headers as any).authorization = `Bearer ${access}`;
  }

  const upstream = await fetch(url, init);

  // devolve o erro original para debug (em vez de esconder)
  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json(
      { where: 'upstream', status: upstream.status, error: text || upstream.statusText },
      { status: upstream.status }
    );
  }

  // sucesso: passa JSON tal-qual
  const data = await upstream.text();
  return new NextResponse(data, {
    status: 200,
    headers: { 'content-type': upstream.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
