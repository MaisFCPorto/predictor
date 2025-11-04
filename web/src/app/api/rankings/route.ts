// web/src/app/api/rankings/route.ts
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = process.env.API_BASE!;

function targetBase(req: NextRequest) {
  const qs = req.nextUrl.search || '';
  return `${UPSTREAM}/api/rankings${qs}`;
}

async function forward(req: NextRequest) {
  if (!UPSTREAM) {
    return new Response(JSON.stringify({ error: 'Server misconfig: API_BASE missing' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const headers = new Headers(req.headers);
  headers.set('cache-control', 'no-store');

  const init: RequestInit = {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.blob(),
    redirect: 'manual',
    cache: 'no-store',
  };

  const upstream = await fetch(targetBase(req), init);
  const resHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'content-encoding') resHeaders.set(k, v);
  });

  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest, _ctx: any)    { return forward(req); }
export async function POST(req: NextRequest, _ctx: any)   { return forward(req); }
export async function PUT(req: NextRequest, _ctx: any)    { return forward(req); }
export async function PATCH(req: NextRequest, _ctx: any)  { return forward(req); }
export async function DELETE(req: NextRequest, _ctx: any) { return forward(req); }
