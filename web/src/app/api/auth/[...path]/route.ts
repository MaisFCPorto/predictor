// web/src/app/api/auth/[...path]/route.ts
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic'; // evitar cache do Next em prod

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;
function targetUrl(req: NextRequest, pathSegs: string[]) {
  const path = pathSegs?.join('/') ?? '';
  const qs = req.nextUrl.search || '';
  return `${API_BASE}/api/auth/${path}${qs}`;
}

async function proxy(req: NextRequest, ctx: { params: { path?: string[] } }) {
  const url = targetUrl(req, ctx.params.path ?? []);

  // 🔧 CORREÇÃO: criar Headers explícitos (evita "init.headers is possibly undefined")
  const headers = new Headers(req.headers);
  headers.delete('host');                 // não enviar host do Vercel
  headers.set('cache-control', 'no-store');

  const init: RequestInit = {
    method: req.method,
    headers,
    // body só quando faz sentido
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(),
    redirect: 'manual',
  };

  const upstream = await fetch(url, init);

  // Copiar headers relevantes (inclui múltiplos Set-Cookie)
  const resHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (k === 'content-encoding' || k === 'transfer-encoding') return;
    if (k === 'set-cookie') resHeaders.append(k, v);
    else resHeaders.set(k, v);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

// Exportar handlers para todos os métodos suportados
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
