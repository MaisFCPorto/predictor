// src/app/api/admin/[[...path]]/route.ts
import { NextRequest, NextResponse } from 'next/server';

// garante que corre no server e sem cache
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = process.env.API_BASE /* ex.: https://predictor-porto-api.pred... */;

function buildTarget(req: NextRequest) {
  // remove o prefixo /api/admin para construir a rota no worker
  const rest = req.nextUrl.pathname.replace(/^\/api\/admin\/?/, '');
  const qs = req.nextUrl.search; // inclui '?...'
  return `${UPSTREAM}/api/${rest}${qs}`;
}

// replica método, headers e body do cliente
async function forward(req: NextRequest) {
  if (!UPSTREAM) {
    return NextResponse.json(
      { error: 'Server misconfig: API_BASE missing' },
      { status: 500 }
    );
  }

  const target = buildTarget(req);

  // copiar headers de forma segura
  const outgoing = new Headers(req.headers);
  outgoing.set('cache-control', 'no-store');

  // **chave só no servidor** (NUNCA no client)
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey) outgoing.set('x-admin-key', adminKey);

  const init: RequestInit = {
    method: req.method,
    headers: outgoing,
    // só certos métodos têm body
    body:
      req.method === 'GET' || req.method === 'HEAD'
        ? undefined
        : (await req.blob()) as any,
    redirect: 'manual',
    // não caches no fetch do node
    cache: 'no-store',
  };

  const upstream = await fetch(target, init);

  // reenvia status + headers + body tal e qual
  const resHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    // evita propagarmos cabeçalhos problemáticos
    if (k.toLowerCase() !== 'content-encoding') resHeaders.set(k, v);
  });

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

// 👉 NÃO tipar o 2.º argumento (evita o erro do build)
export async function GET(req: NextRequest, _ctx: any)   { return forward(req); }
export async function POST(req: NextRequest, _ctx: any)  { return forward(req); }
export async function PATCH(req: NextRequest, _ctx: any) { return forward(req); }
export async function PUT(req: NextRequest, _ctx: any)    { return forward(req); }
export async function DELETE(req: NextRequest, _ctx: any) { return forward(req); }
