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
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          res.cookies.set(name, value, { ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          res.cookies.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const path = new URL(req.url).pathname;

  // permite público + assets
  const PUBLIC = ['/', '/auth', '/favicon.ico'];
  const isPublic = PUBLIC.some(p => path === p || path.startsWith(p))
    || path.startsWith('/_next')
    || path.startsWith('/assets')
    || path.startsWith('/images')
    || path.startsWith('/api'); // as tuas APIs públicas

  if (isPublic) {
    if (session && (path === '/' || path.startsWith('/auth'))) {
      return NextResponse.redirect(new URL('/jogos', req.url));
    }
    return res;
  }

  // para tudo o resto precisa de sessão
  if (!session) return NextResponse.redirect(new URL('/', req.url));

  return res;
}

export const config = {
  matcher: ['/((?!.*\\.).*)'], // aplica-se a páginas
};
