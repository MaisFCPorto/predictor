// web/src/app/api/admin/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CookieLike = { name: string; value: string };

// ⬇️ torna async e usa await cookies()
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
  // 1) Authorization header OU cookie do Supabase (agora com await)
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

  // 2) Supabase: /auth/v1/user
  const meRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cache: 'no-store',
  });

  if (!meRes.ok) {
    const body = await meRes.text();
    return NextResponse.json(
      { where: '/api/admin/check', status: meRes.status, msg: body || 'auth error' },
      { status: meRes.status }
    );
  }

  const me = (await meRes.json()) as { email?: string };
  const email = me?.email;
  if (!email) {
    return NextResponse.json(
      { where: '/api/admin/check', status: 400, msg: 'user has no email' },
      { status: 400 }
    );
  }

  // 3) Worker (D1): role por e-mail
  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/admin/role?email=${encodeURIComponent(
    email
  )}`;
  const roleRes = await fetch(url, {
    headers: { 'X-Admin-Key': process.env.ADMIN_KEY! },
    cache: 'no-store',
  });

  if (!roleRes.ok) {
    const body = await roleRes.text();
    return NextResponse.json(
      { where: '/api/admin/check', status: roleRes.status, msg: body || 'role lookup error' },
      { status: roleRes.status }
    );
  }

  const data = (await roleRes.json()) as { role?: string };
  const role = data?.role ?? 'user';
  if (role !== 'admin') {
    return NextResponse.json(
      { where: '/api/admin/check', status: 403, msg: { error: 'forbidden' } },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, role: 'admin', email });
}
