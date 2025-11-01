import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic' // evita cache de rota
// export const runtime = 'nodejs' // descomenta se preferires garantir Node.js

function parseBase64Json(value: string) {
  try {
    const raw = value.replace(/^base64-/, '')
    // atob existe no Edge/Browser; em Node 20+ também existe no global
    const json = typeof atob === 'function'
      ? atob(raw)
      : Buffer.from(raw, 'base64').toString('utf8') // fallback se estiveres em Node
    return JSON.parse(json)
  } catch {
    return null
  }
}

async function readTokenFromSupabaseCookie(): Promise<string | null> {
  // compat: algumas versões expõem cookies() síncrono e outras assíncrono
  const jarAny = await Promise.resolve(cookies() as any)
  const all = typeof jarAny.getAll === 'function' ? jarAny.getAll() : []
  const supa = all.find(
    (c: any) => typeof c?.name === 'string'
      && c.name.startsWith('sb-')
      && c.name.endsWith('-auth-token')
  )

  if (!supa?.value) return null

  const obj = parseBase64Json(String(supa.value))
  return obj?.access_token ?? null
}

export async function GET(req: NextRequest) {
  // 1) Token via Authorization: Bearer ... OU via cookie do Supabase
  const auth = req.headers.get('authorization')
  let token =
    auth?.toLowerCase().startsWith('bearer ')
      ? auth.slice(7).trim()
      : await readTokenFromSupabaseCookie()

  if (!token) {
    return NextResponse.json(
      { where: '/api/admin/check', status: 401, msg: 'missing token' },
      { status: 401 }
    )
  }

  // 2) Quem é o utilizador no Supabase?
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.json(
      { where: '/api/admin/check', status: 500, msg: 'supabase env missing' },
      { status: 500 }
    )
  }

  const meRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnon,
    },
    cache: 'no-store',
  })

  if (!meRes.ok) {
    const body = await meRes.text()
    return NextResponse.json(
      { where: '/api/admin/check', status: meRes.status, msg: body || 'auth error' },
      { status: meRes.status }
    )
  }

  const me = await meRes.json()
  const email: string | undefined = me?.email
  if (!email) {
    return NextResponse.json(
      { where: '/api/admin/check', status: 400, msg: 'user has no email' },
      { status: 400 }
    )
  }

  // 3) Perguntar o role à **API (Cloudflare Worker → D1)**
  const apiBase = process.env.API_BASE // <-- server-only
  const adminKey = process.env.API_ADMIN_KEY // <-- server-only

  if (!apiBase || !adminKey) {
    return NextResponse.json(
      { where: '/api/admin/check', status: 500, msg: 'api env missing' },
      { status: 500 }
    )
  }

  const url = `${apiBase}/api/admin/role?email=${encodeURIComponent(email)}`
  const roleRes = await fetch(url, {
    headers: {
      'x-admin-key': adminKey, // case-insensitive; no Worker validas este header
    },
    cache: 'no-store',
  })

  if (!roleRes.ok) {
    const body = await roleRes.text()
    return NextResponse.json(
      { where: '/api/admin/check', status: roleRes.status, msg: body || 'role lookup error' },
      { status: roleRes.status }
    )
  }

  const { role = 'user' } = await roleRes.json()

  if (role !== 'admin') {
    return NextResponse.json(
      { where: '/api/admin/check', status: 403, msg: 'forbidden', role },
      { status: 403 }
    )
  }

  return NextResponse.json({ ok: true, role: 'admin', email })
}
