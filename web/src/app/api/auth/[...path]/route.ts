import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

function targetUrl(req: NextRequest, path: string[]) {
  const qs = req.nextUrl.search || '';
  return `${API_BASE}/api/auth/${path.join('/')}${qs}`;
}

async function forward(req: NextRequest, path: string[]) {
  const url = targetUrl(req, path);

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.set('cache-control', 'no-store');

  const init: RequestInit = {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(),
    redirect: 'manual',
  };

  const upstream = await fetch(url, init);

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

// ==== Handlers com tipo inline ====
export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(req, params.path);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(req, params.path);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(req, params.path);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(req, params.path);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(req, params.path);
}

export async function OPTIONS(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(req, params.path);
}
