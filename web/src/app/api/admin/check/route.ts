// web/src/app/api/admin/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CookieLike = { name: string; value: string };

async function readSupabaseAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const supa = (jar.getAll() as CookieLike[]).find(
    c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  );
  if (!supa?.value) return null;

  try {
    const json = Buffer.from(supa.value.replace(/^base64-/, ''), 'base64').toString('utf8');
    const obj = JSON.parse(json);
    return obj?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  // 1) token pelo header ou cookie do Supabase
  const auth = req.headers.get('authorization');
  const token =
    auth?.toLowerCase().startsWith('bearer ')
      ? auth.slice(7).trim()
      : await readSupabaseAccessToken();

  if (!token) {
    return NextResponse.json(
      { where: '/api/admin/check', status: 401, msg: 'missing token' },
      { status: 401 }
    );
  }

  // 2) perguntar ao Supabase quem é o user
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const meRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    cache: 'no-store',
  });

  const meTxt = await meRes.text();
  if (!meRes.ok) {
    return NextResponse.json(
      { where: '/api/admin/check', status: meRes.status, msg: meTxt || 'auth error' },
      { status: meRes.status }
    );
  }

  let email = '';
  try {
    const me = JSON.parse(meTxt);
    email = me?.email || '';
  } catch {
    // fallback se vier texto
  }
  if (!email) {
    return NextResponse.json(
      { where: '/api/admin/check', status: 400, msg: 'user has no email', meTxt },
      { status: 400 }
    );
  }

  // 3) pedir o role ao Worker (Cloudflare → D1)
  //    Tenta as duas variáveis comuns que usamos neste projeto
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.API_BASE ||
    '';
  const upstreamUrl = `${apiBase.replace(/\/$/, '')}/api/admin/role?email=${encodeURIComponent(
    email
  )}`;

  const adminKey = process.env.ADMIN_KEY || process.env.API_ADMIN_KEY || '';
  const roleRes = await fetch(upstreamUrl, {
    headers: { 'X-Admin-Key': adminKey },
    cache: 'no-store',
  });

  const roleTxt = await roleRes.text();
  let role: string | undefined;
  try {
    role = JSON.parse(roleTxt)?.role;
  } catch {
    // se não for JSON, mostramos o texto na resposta de debug
  }

  if (!roleRes.ok) {
    return NextResponse.json(
      {
        where: '/api/admin/check',
        status: roleRes.status,
        msg: roleTxt || 'role lookup error',
        debug: { upstreamUrl, sentAdminKey: !!adminKey },
      },
      { status: roleRes.status }
    );
  }

  if (role !== 'admin') {
    return NextResponse.json(
      {
        where: '/api/admin/check',
        status: 403,
        msg: JSON.stringify({ error: 'forbidden' }),
        debug: { email, role, upstreamUrl, sentAdminKey: !!adminKey, roleRaw: roleTxt },
      },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, role: 'admin', email });
}
