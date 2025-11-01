// Next.js App Router
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';   // nunca cache
export const revalidate = 0;              // nunca revalidate

async function readSupabaseAccessToken(): Promise<string | null> {
  const jar = await cookies();                           // lê cookies do request
  const supa = jar.getAll().find(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
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
  // 1) token: Authorization: Bearer ... ou cookie do supabase
  const auth = req.headers.get('authorization');
  const token = auth?.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : await readSupabaseAccessToken();

  if (!token) {
    return NextResponse.json(
      { where: '/api/admin/check', status: 401, msg: 'missing token' },
      { status: 401 }
    );
  }

  // 2) pergunta ao supabase quem é o user
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

  const me = await meRes.json();
  const email: string | undefined = me?.email;
  if (!email) {
    return NextResponse.json(
      { where: '/api/admin/check', status: 400, msg: 'user has no email' },
      { status: 400 }
    );
  }

  // 3) pede o role ao Worker (Cloudflare → D1)
  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/admin/role?email=${encodeURIComponent(email)}`;
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

  const data = await roleRes.json(); // { role: 'admin' | 'user' | ... }
  const role = data?.role ?? 'user';

  if (role !== 'admin') {
    return NextResponse.json(
      { where: '/api/admin/check', status: 403, msg: 'forbidden', role },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, role: 'admin', email });
}
