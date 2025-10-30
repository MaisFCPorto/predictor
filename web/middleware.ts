// apps/web/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  // Pass-through + permite que o Supabase actualize cookies
  let res = NextResponse.next({ request: { headers: req.headers } })

  const url = new URL(req.url)
  const path = url.pathname

  // Só protegemos /admin; o resto passa
  const isAdmin = path.startsWith('/admin')
  const isPublic =
    path === '/' ||
    path.startsWith('/auth') ||
    path.startsWith('/favicon') ||
    path.startsWith('/_next') ||
    path.startsWith('/assets') ||
    path.startsWith('/images')

  if (!isAdmin || isPublic) {
    // Headers de debug leves
    res.headers.set('x-mw-scope', isAdmin ? 'admin' : 'public')
    res.headers.set('x-mw-path', path)
    return res
  }

  // --- Debug: ver que cookies chegam ao middleware ---
  const cookieNames = Array.from(req.cookies.getAll()).map(c => c.name)
  const authCookie = cookieNames.find(n => n.includes('-auth-token')) || '(none)'
  // ---------------------------------------------------

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set(name, value, { ...options })
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )

  const { data: { session }, error } = await supabase.auth.getSession()

  // Mais headers de debug
  res.headers.set('x-mw-path', path)
  res.headers.set('x-mw-cookie-auth', authCookie)
  res.headers.set('x-mw-session', session ? '1' : '0')
  if (error) res.headers.set('x-mw-error', String(error.message || error))

  if (!session) {
    const redirect = new URL('/auth', req.url)
    redirect.searchParams.set('next', path)
    const r = NextResponse.redirect(redirect)
    // copiar os headers de debug para veres no 302 também
    r.headers.set('x-mw-cookie-auth', authCookie)
    r.headers.set('x-mw-session', '0')
    return r
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*'],
}
