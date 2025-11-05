export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const UPSTREAM = process.env.API_BASE;

function buildTarget(req: NextRequest) {
  const rest = req.nextUrl.pathname.replace(/^\/api\/admin\/?/, '');
  const qs = req.nextUrl.search || '';
  const suffix = rest ? `/${rest}` : '';
  return `${UPSTREAM}/api/admin${suffix}${qs}`;
}

async function forward(req: NextRequest) {
  if (!UPSTREAM) {
    return NextResponse.json({ error: 'API_BASE missing' }, { status: 500 });
  }

  const target = buildTarget(req);
  const headers = new Headers(req.headers);
  headers.set('cache-control', 'no-store');
  const adminKey = (process.env.API_ADMIN_KEY || process.env.ADMIN_KEY || '').trim();
  if (adminKey) headers.set('x-admin-key', adminKey);

  let body: ArrayBuffer | undefined = undefined;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    body = await req.arrayBuffer();
  }

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
    redirect: 'manual',
    cache: 'no-store',
  });

  const resHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'content-encoding') resHeaders.set(k, v);
  });

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function OPTIONS() {
  const h = new Headers();
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  h.set('Access-Control-Allow-Headers', '*');
  h.set('Access-Control-Max-Age', '86400');
  return new NextResponse(null, { status: 204, headers: h });
}

export async function GET(req: NextRequest)    { return forward(req); }
export async function POST(req: NextRequest)   { return forward(req); }
export async function PATCH(req: NextRequest)  { return forward(req); }
export async function PUT(req: NextRequest)    { return forward(req); }
export async function DELETE(req: NextRequest) { return forward(req); }
