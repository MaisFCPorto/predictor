import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API = process.env.NEXT_PUBLIC_API_URL!;
const ADMIN_KEY = process.env.ADMIN_KEY!;

async function readTokenFromSupabaseCookie(): Promise<string | null> {
  const jar = await cookies();
  const supa = jar.getAll().find(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'),
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
  // 0) sanity
  if (!API || !ADMIN_KEY) {
    return NextResponse.json(
      { error: 'Server misconfig: NEXT_PUBLIC_API_URL or ADMIN_KEY missing' },
      { status: 500 },
    );
  }

  // 1) Bearer OU cookie Supabase
  const auth = req.headers.get('authorization');
  let token =
    auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : await readTokenFromSupabaseCookie();

  if (!token) {
    return NextResponse.json(
      { where: '/api/admin/check', status: 401, msg: 'missing token' },
      { status: 401 },
    );
  }

  // 2) Quem é o user no Supabase?
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
      { status: meRes.status },
    );
  }

  const me = await meRes.json();
  const email: string | undefined = me?.email;
  if (!email) {
    return NextResponse.json(
      { where: '/api/admin/check', status: 400, msg: 'user has no email' },
      { status: 400 },
    );
  }

  // 3) Pergunta ao Worker o role
  const roleRes = await fetch(
    `${API.replace(/\/$/, '')}/api/admin/role?email=${encodeURIComponent(email)}`,
    {
      headers: { 'x-admin-key': ADMIN_KEY },
      cache: 'no-store',
    },
  );

  if (!roleRes.ok) {
    const msg = await roleRes.text();
    return NextResponse.json(
      { where: '/api/admin/check', status: roleRes.status, msg: msg || 'role lookup error' },
      { status: roleRes.status },
    );
  }

  const data = await roleRes.json(); // { role: 'admin' | 'user' | ... }
  if (data?.role !== 'admin') {
    return NextResponse.json(
      { where: '/api/admin/check', status: 403, msg: 'forbidden' },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, role: 'admin', email });
}
