// Roda no server, sem cache
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const UPSTREAM = process.env.API_BASE; // ex.: https://<teu-worker>.workers.dev

function buildTarget(req: NextRequest) {
  const rest = req.nextUrl.pathname.replace(/^\/api\/admin\/?/, '');
  const qs = req.nextUrl.search || '';
  // evita '//' quando rest está vazio
  const suffix = rest ? `/${rest}` : '';
  return `${UPSTREAM}/api/admin${suffix}${qs}`;
}

async function forward(req: NextRequest) {
  if (!UPSTREAM) {
    return NextResponse.json({ error: 'Server misconfig: API_BASE missing' }, { status: 500 });
  }

  const target = buildTarget(req);

  // Copia headers e evita cache
  const headers = new Headers(req.headers);
  headers.set('cache-control', 'no-store');

  // Chave admin só no servidor
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

  // Re-envia a resposta tal e qual (sem content-encoding para evitar gzip duplo)
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

// Exporta todos os métodos
export async function GET(req: NextRequest)    { return forward(req); }
export async function POST(req: NextRequest)   { return forward(req); }
export async function PATCH(req: NextRequest)  { return forward(req); }
export async function PUT(req: NextRequest)    { return forward(req); }
export async function DELETE(req: NextRequest) { return forward(req); }
