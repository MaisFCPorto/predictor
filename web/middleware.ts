// apps/web/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  // passa os headers para o Next poder reescrever cookies
  let res = NextResponse.next({ request: { headers: req.headers } })

  const url = new URL(req.url)
  const path = url.pathname

  // rotas públicas/estáticas
  const isPublic =
    path === '/' ||
    path.startsWith('/auth') ||
    path.startsWith('/favicon') ||
    path.startsWith('/_next') ||
    path.startsWith('/assets') ||
    path.startsWith('/images')

  if (isPublic) return res

  // ——— protecção só para /admin ———
  if (!path.startsWith('/admin')) return res

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

  const { data: { session } } = await supabase.auth.getSession()

  // sem sessão -> /auth
  if (!session) {
    const redirect = new URL('/auth', req.url)
    redirect.searchParams.set('next', path) // para poderes voltar depois
    return NextResponse.redirect(redirect)
  }

  // com sessão -> segue
  return res
}

// o middleware só corre em /admin/**
export const config = {
  matcher: ['/admin/:path*'],
}
