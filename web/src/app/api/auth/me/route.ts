// apps/web/src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function readTokenFromSupabaseCookie(): Promise<string | null> {
  const jar = await cookies();
  const supa = jar
    .getAll()
    .find(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));

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
  // 1) tenta Authorization: Bearer
  const auth = req.headers.get('authorization');
  let token =
    auth && auth.toLowerCase().startsWith('bearer ')
      ? auth.slice(7).trim()
      : null;

  // 2) fallback: tenta cookie do supabase
  if (!token) token = await readTokenFromSupabaseCookie();

  if (!token) {
    return NextResponse.json(
      { where: '/api/auth/me', status: 401, msg: 'missing token' },
      { status: 401 }
    );
  }

  // pede o utilizador ao Supabase a partir do token
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json(
      { where: '/api/auth/me', status: res.status, msg: body || 'upstream error' },
      { status: res.status }
    );
  }

  const user = await res.json();

  return NextResponse.json({ user });
}
