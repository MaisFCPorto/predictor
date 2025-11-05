// Roda no server, sem cache
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const UPSTREAM = process.env.API_BASE; // ex.: https://predictor-porto-api.predictorporto.workers.dev


function buildTarget(req: NextRequest) {
  // remove o prefixo local /api/admin e reencaminha para o worker em /api/admin/<rest>
  const rest = req.nextUrl.pathname.replace(/^\/api\/admin\/?/, '');
  const qs = req.nextUrl.search || '';
  return `${UPSTREAM}/api/admin/${rest}${qs}`; // <-- mantém 'admin' aqui
}

async function forward(req: NextRequest) {
  if (!UPSTREAM) {
    return NextResponse.json({ error: 'Server misconfig: API_BASE missing' }, { status: 500 });
  }

  const target = buildTarget(req);

  const headers = new Headers(req.headers);
  headers.set('cache-control', 'no-store');

  // chave só no servidor
  const adminKey = (process.env.API_ADMIN_KEY || process.env.ADMIN_KEY || '').trim();
  if (adminKey) headers.set('x-admin-key', adminKey);

  const init: RequestInit = {
    method: req.method,
    headers,
    body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : await req.blob(),
    redirect: 'manual',
    cache: 'no-store',
  };

  const upstream = await fetch(target, init);

  const outHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'content-encoding') outHeaders.set(k, v);
  });

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

// NÃO tipar o 2º arg para evitar erros na build
export async function GET(req: NextRequest, _ctx: any)    { return forward(req); }
export async function POST(req: NextRequest, _ctx: any)   { return forward(req); }
export async function PATCH(req: NextRequest, _ctx: any)  { return forward(req); }
export async function PUT(req: NextRequest, _ctx: any)    { return forward(req); }
export async function DELETE(req: NextRequest, _ctx: any) { return forward(req); }
