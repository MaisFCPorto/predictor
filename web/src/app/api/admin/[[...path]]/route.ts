// Roda no servidor e sem cache
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const UPSTREAM = process.env.API_BASE!; // ex.: https://predictor-porto-api.predictorporto.workers.dev

function buildTarget(u: URL) {
  // Mantém /admin — só retiramos o prefixo /api do Next
  const qs = u.search ?? '';
  const pathWithoutApi = u.pathname.replace(/^\/api/, ''); // "/admin/competitions"
  return `${UPSTREAM}/api${pathWithoutApi}${qs}`;          // "…/api/admin/competitions"
}

async function forward(req: NextRequest) {
  if (!UPSTREAM) {
    return NextResponse.json({ error: 'Server misconfig: API_BASE missing' }, { status: 500 });
  }

  const adminKey = (process.env.API_ADMIN_KEY ?? process.env.ADMIN_KEY ?? '').trim();

  // Copiamos headers do cliente e forçamos no-store
  const outgoing = new Headers(req.headers);
  outgoing.set('cache-control', 'no-store');
  if (adminKey) outgoing.set('x-admin-key', adminKey); // chave só no servidor

  const init: RequestInit = {
    method: req.method,
    headers: outgoing,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : (await req.blob()) as any,
    redirect: 'manual',
    cache: 'no-store',
  };

  const upstream = await fetch(buildTarget(req.nextUrl), init);

  const headers = new Headers(upstream.headers);
  headers.delete('content-encoding'); // evita problemas de streaming

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
