import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lê access_token do cookie do Supabase (sb-*-auth-token) */
async function readSupabaseAccessToken(): Promise<string | null> {
  const jar = await cookies();
  // getAll precisa de await (Next 15)
  const all = jar.getAll();
  const supa = (all as { name: string; value: string }[]).find(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  );
  if (!supa?.value) return null;

  try {
    const json = Buffer.from(supa.value.replace(/^base64-/, ''), 'base64').toString('utf8');
    const obj = JSON.parse(json);
    // estrutura padrão { access_token, refresh_token, ... }
    return obj?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const debug: Record<string, unknown> = {
    step: 'start',
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
    runtime,
  };

  // 1) token via Authorization ou cookie do Supabase
  const auth = req.headers.get('authorization');
  let token =
    auth?.toLowerCase().startsWith('bearer ')
      ? auth.slice(7).trim()
      : await readSupabaseAccessToken();

  debug.hasAuthHeader = !!auth;
  debug.hasCookieToken = !auth && !!token;

  if (!token) {
    return NextResponse.json(
      { where: '/api/admin/check', status: 401, msg: 'missing token', debug },
      { status: 401 }
    );
  }

  // 2) perguntar ao Supabase quem é o user
  const supaUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  debug.supaUrl = !!supaUrl;
  debug.hasAnon = !!anon;

  const meRes = await fetch(`${supaUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
    cache: 'no-store',
  });

  if (!meRes.ok) {
    const body = await meRes.text();
    debug.meResStatus = meRes.status;
    return NextResponse.json(
      { where: '/api/admin/check', status: meRes.status, msg: body || 'auth error', debug },
      { status: meRes.status }
    );
  }

  const me = (await meRes.json()) as { email?: string | null };
  const email = (me.email || '').toLowerCase();

  debug.email = email;

  if (!email) {
    return NextResponse.json(
      { where: '/api/admin/check', status: 400, msg: 'user has no email', debug },
      { status: 400 }
    );
  }

  // 3) ALLOWLIST por env (para desbloquear já)
  const allowRaw = process.env.ADMIN_EMAILS || '';
  const allow = allowRaw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  debug.allowRaw = allowRaw;
  debug.allow = allow;

  if (allow.includes(email)) {
    debug.bypass = 'env-allowlist';
    return NextResponse.json({ ok: true, role: 'admin', email, debug });
  }

  // 4) Caso não esteja no allowlist, pergunta ao Worker pelo role
  const base =
    (process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE ||
      process.env.API_BASE ||
      '').replace(/\/$/, '');

  const adminKey =
    process.env.ADMIN_KEY || process.env.API_ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '';

  const upstream = `${base}/api/admin/role?email=${encodeURIComponent(email)}`;
  debug.upstreamUrl = upstream;
  debug.sentAdminKey = !!adminKey;

  const roleRes = await fetch(upstream, {
    headers: { 'X-Admin-Key': adminKey },
    cache: 'no-store',
  });

  const text = await roleRes.text();
  debug.roleResStatus = roleRes.status;
  debug.roleRaw = text;

  if (!roleRes.ok) {
    return NextResponse.json(
      { where: '/api/admin/check', status: roleRes.status, msg: text || 'role lookup error', debug },
      { status: roleRes.status }
    );
  }

  let role = 'user';
  try {
    const j = JSON.parse(text);
    role = j?.role ?? 'user';
  } catch {
    // ok, já guardámos o raw no debug
  }
  debug.role = role;

  if (role !== 'admin') {
    return NextResponse.json(
      { where: '/api/admin/check', status: 403, msg: JSON.stringify({ error: 'forbidden' }), debug },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, role: 'admin', email, debug });
}
