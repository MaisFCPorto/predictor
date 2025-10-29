// apps/web/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set(name, value, { ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  const url = new URL(req.url);
  const path = url.pathname;

  // Rotas públicas (não exigem sessão)
  const PUBLIC = new Set([
    '/',             // <— root é público para mostrar a landing
    '/auth',         // inclui /auth e /auth/callback
    '/api',          // se tens APIs públicas, mantém; senão remove
    '/favicon.ico',
  ]);

  // permite também assets internos do Next/Turbopack
  if (
    path.startsWith('/_next') ||
    path.startsWith('/assets') ||
    path.startsWith('/images') ||
    path.startsWith('/api') ||
    Array.from(PUBLIC).some(p => path === p || path.startsWith(p))
  ) {
    // se JÁ tem sessão e tentou ir a / ou /auth*, manda para /jogos
    if (session && (path === '/' || path.startsWith('/auth'))) {
      return NextResponse.redirect(new URL('/jogos', req.url));
    }
    return res;
  }

  // A partir daqui é privado -> sem sessão volta para / (landing)
  if (!session) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return res;
}
