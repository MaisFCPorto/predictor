// Roda no server (App Router)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const UPSTREAM = process.env.API_BASE; // ex.: https://predictor-porto-api.predictorporto.workers.dev

function buildTarget(req: NextRequest) {
  // pathname tipo: /api/admin/fixtures, /api/admin/fixtures/g2, /api/admin
  const path = req.nextUrl.pathname;
  // remove o prefixo /api/admin e a eventual barra seguinte
  const rest = path.replace(/^\/api\/admin(?:\/|$)/, ''); // -> 'fixtures', 'fixtures/g2' ou ''
  const qs = req.nextUrl.search || '';
  // monta o alvo
  return rest
    ? `${UPSTREAM}/api/admin/${rest}${qs}`
    : `${UPSTREAM}/api/admin${qs}`;
}

function misconfig() {
  return NextResponse.json({ error: 'API_BASE missing' }, { status: 500 });
}

async function forward(req: NextRequest) {
  if (!UPSTREAM) return misconfig();

  const target = buildTarget(req);

  // Copiar headers e acrescentar admin key só no servidor
  const headers = new Headers(req.headers);
  headers.set('cache-control', 'no-store');
  const adminKey = (process.env.API_ADMIN_KEY || process.env.ADMIN_KEY || '').trim();
  if (adminKey) headers.set('x-admin-key', adminKey);

  // Só envia body em métodos com body
  let body: ArrayBuffer | undefined;
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

  // Copiar headers, evitando content-encoding
  const out = new Headers();
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'content-encoding') out.set(k, v);
  });

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

// Preflight — seguro mesmo em same-origin
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
