export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const UPSTREAM = process.env.API_BASE!;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!UPSTREAM) {
    return NextResponse.json({ error: 'API_BASE missing' }, { status: 500 });
  }
  const qs = req.nextUrl.search || '';
  const url = `${UPSTREAM}/api/users/role/${encodeURIComponent(params.id)}${qs}`;

  const upstream = await fetch(url, { method: 'GET', headers: req.headers, cache: 'no-store' });

  const headers = new Headers();
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'content-encoding') headers.set(k, v);
  });

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, { status: upstream.status, headers });
}
