// apps/web/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: { headers: req.headers },
  })

  const supabase = createServerClient(
    // usa também as variáveis sem NEXT_ se existirem (Vercel às vezes só injeta essas no edge)
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // importante: set na *response* que vamos devolver
          res.cookies.set(name, value, { ...options })
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )

  const url = new URL(req.url)
  const path = url.pathname

  // Zonas públicas (deixa passar sempre)
  const PUBLIC_PREFIXES = ['/_next', '/assets', '/images', '/favicon.ico', '/auth', '/login', '/api/public']
  const isPublic = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p)) || path === '/'

  if (isPublic) {
    // se já tem sessão e está em / ou /auth, manda para /jogos (qualquer coisa do género)
    const { data: { session } } = await supabase.auth.getSession()
    if (session && (path === '/' || path.startsWith('/auth') || path === '/login')) {
      return NextResponse.redirect(new URL('/jogos', req.url))
    }
    return res
  }

  // Bloqueia apenas a zona /admin sem sessão
  if (path.startsWith('/admin')) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.redirect(new URL('/', req.url)) // volta à landing
    }
  }

  return res
}
