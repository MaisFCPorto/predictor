// Roda no server (App Router)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const UPSTREAM = process.env.API_BASE; // ex.: https://…workers.dev

function buildTarget(req: NextRequest) {
  // tira o prefixo /api/admin e reencaminha para /api/admin/<resto>
  const rest = req.nextUrl.pathname.replace(/^\/api\/admin\/?/, '');
  const qs = req.nextUrl.search || '';
  const suffix = rest ? `/${rest}` : '';
  return `${UPSTREAM}/api/admin${suffix}${qs}`;
}

function missingUpstream() {
  return NextResponse.json(
    { error: 'Server misconfig: API_BASE missing' },
    { status: 500 },
  );
}

async function forward(req: NextRequest) {
  if (!UPSTREAM) return missingUpstream();

  const target = buildTarget(req);

  const outgoing = new Headers(req.headers);
  outgoing.set('cache-control', 'no-store');

  // envia a chave admin do lado do servidor
  const adminKey =
    (process.env.API_ADMIN_KEY || process.env.ADMIN_KEY || '').trim();
  if (adminKey) outgoing.set('x-admin-key', adminKey);

  // só mete body nos métodos que têm body
  let body: ArrayBuffer | undefined = undefined;
  if (!(req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS')) {
    body = await req.arrayBuffer();
  }

  const upstream = await fetch(target, {
    method: req.method,
    headers: outgoing,
    body,
    redirect: 'manual',
    cache: 'no-store',
  });

  const outHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'content-encoding') outHeaders.set(k, v);
  });

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

// Preflight
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
