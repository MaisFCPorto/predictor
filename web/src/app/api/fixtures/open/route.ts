import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = process.env.API_BASE || process.env.NEXT_PUBLIC_API_URL_BASE;

function buildTarget(req: NextRequest) {
  const qs = req.nextUrl.search || '';
  return `${UPSTREAM}/api/fixtures/open${qs}`;
}

export async function GET(req: NextRequest) {
  if (!UPSTREAM) return NextResponse.json({ error: 'API_BASE missing' }, { status: 500 });

  const upstream = await fetch(buildTarget(req), { cache: 'no-store', headers: { accept: 'application/json' } });
  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  upstream.headers.forEach((v, k) => { if (k !== 'content-encoding') headers.set(k, v); });
  return new NextResponse(body, { status: upstream.status, statusText: upstream.statusText, headers });
}
