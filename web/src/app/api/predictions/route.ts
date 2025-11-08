// apps/web/src/app/api/predictions/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const UPSTREAM = process.env.API_BASE; // ex.: https://...workers.dev

function urlFor(req: NextRequest) {
  return `${UPSTREAM}/api/predictions${req.nextUrl.search || ''}`;
}

export async function OPTIONS() {
  const h = new Headers();
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  h.set('Access-Control-Allow-Headers', '*');
  h.set('Access-Control-Max-Age', '86400');
  return new NextResponse(null, { status: 204, headers: h });
}

async function forward(req: NextRequest) {
  if (!UPSTREAM) {
    return NextResponse.json({ error: 'API_BASE missing' }, { status: 500 });
  }

  // clone headers + força no-store
  const headers = new Headers(req.headers);
  headers.set('cache-control', 'no-store');

  let body: ArrayBuffer | undefined;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    body = await req.arrayBuffer();
    // garante content-type json se ainda não vier
    if (!headers.get('content-type')) headers.set('content-type', 'application/json');
  }

  const resp = await fetch(urlFor(req), {
    method: req.method,
    headers,
    body,
    redirect: 'manual',
    cache: 'no-store',
  });

  // copia headers da resposta (sem content-encoding)
  const out = new Headers();
  resp.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'content-encoding') out.set(k, v);
  });

  const buf = await resp.arrayBuffer();
  return new NextResponse(buf, { status: resp.status, statusText: resp.statusText, headers: out });
}

export async function POST(req: NextRequest) { return forward(req); }
export async function GET(req: NextRequest) { return forward(req); }
