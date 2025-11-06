export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const UPSTREAM = process.env.API_BASE; // ex.: https://predictor-porto-api.predictorporto.workers.dev

function buildTarget(req: NextRequest) {
  // Encaminha mantendo o path completo (ex.: /api/admin/...) para o UPSTREAM
  const path = req.nextUrl.pathname; // já começa por /api/admin/... no nosso caso
  const qs = req.nextUrl.search || '';
  return `${UPSTREAM}${path}${qs}`;
  // const suffix = rest ? `/${rest}` : '';
  // return `${UPSTREAM}/api/admin${suffix}${qs}`;
}

function missing() {
  return NextResponse.json({ error: 'API_BASE missing' }, { status: 500 });
}

async function forward(req: NextRequest) {
  if (!UPSTREAM) return missing();

  const target = buildTarget(req);
  const headers = new Headers(req.headers);
  headers.set('cache-control', 'no-store');

  const adminKey = (process.env.API_ADMIN_KEY || process.env.ADMIN_KEY || '').trim();
  if (adminKey) headers.set('x-admin-key', adminKey);

  let body: ArrayBuffer | undefined;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    body = await req.arrayBuffer();
  }

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
    redirect: 'manual',
    // 'cache' is a browser-only field; Next.js server runtime throws if set. Use Cache-Control header instead.
  });

  const out = new Headers();
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'content-encoding') out.set(k, v);
  });

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, { status: upstream.status, headers: out });
}

// Preflight (alguns browsers fazem OPTIONS mesmo em same-origin)
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
