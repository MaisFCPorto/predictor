// apps/web/src/app/api/users/sync/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
const UPSTREAM = process.env.API_BASE;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function POST(req: NextRequest) {
  if (!UPSTREAM) return NextResponse.json({ error: 'API_BASE missing' }, { status: 500 });

  const headers = new Headers(req.headers);
  headers.set('cache-control', 'no-store');
  if (!headers.get('content-type')) headers.set('content-type', 'application/json');

  const body = await req.arrayBuffer();

  const upstream = await fetch(`${UPSTREAM}/api/users/sync`, {
    method: 'POST',
    headers,
    body,
    cache: 'no-store',
    redirect: 'manual',
  });

  const outHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'content-encoding') outHeaders.set(k, v);
  });

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, { status: upstream.status, headers: outHeaders });
}
