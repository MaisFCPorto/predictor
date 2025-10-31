import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function targetUrl(req: NextRequest, path: string[]) {
  const qs = req.nextUrl.search || '';
  return `${API_BASE}/api/auth/${path.join('/')}${qs}`;
}

async function getSupabaseAccessToken(req: NextRequest) {
    // Captura todos os cookies da request
    const allCookies: Record<string, string> = {};
    req.cookies.getAll().forEach((c) => {
      allCookies[c.name] = c.value;
    });
  
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
      cookies: {
        get: (name: string) => allCookies[name],
        set: () => {},
        remove: () => {},
      },
    });
  
    try {
      const { data } = await supabase.auth.getSession();
      return { token: data.session?.access_token || null, err: null };
    } catch (err: any) {
      return { token: null, err: err.message };
    }
  }
  

async function forward(req: NextRequest, path: string[]) {
  const url = targetUrl(req, path);

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.set('cache-control', 'no-store');

  // ---> injeta Authorization a partir dos cookies do Supabase
  if (!headers.has('authorization')) {
    const token = await getSupabaseAccessToken(req);
    if (token) headers.set('authorization', `Bearer ${token}`);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(),
    redirect: 'manual',
  };

  const upstream = await fetch(url, init);

  const resHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (k === 'content-encoding' || k === 'transfer-encoding') return;
    if (k === 'set-cookie') resHeaders.append(k, v);
    else resHeaders.set(k, v);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest, ctx: any) {
  const path = Array.isArray(ctx?.params?.path) ? ctx.params.path : [];
  return forward(req, path);
}
export async function POST(req: NextRequest, ctx: any) {
  const path = Array.isArray(ctx?.params?.path) ? ctx.params.path : [];
  return forward(req, path);
}
export async function PUT(req: NextRequest, ctx: any) {
  const path = Array.isArray(ctx?.params?.path) ? ctx.params.path : [];
  return forward(req, path);
}
export async function PATCH(req: NextRequest, ctx: any) {
  const path = Array.isArray(ctx?.params?.path) ? ctx.params.path : [];
  return forward(req, path);
}
export async function DELETE(req: NextRequest, ctx: any) {
  const path = Array.isArray(ctx?.params?.path) ? ctx.params.path : [];
  return forward(req, path);
}
export async function OPTIONS(req: NextRequest, ctx: any) {
  const path = Array.isArray(ctx?.params?.path) ? ctx.params.path : [];
  return forward(req, path);
}
