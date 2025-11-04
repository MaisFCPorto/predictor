import type { NextRequest } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = process.env.API_BASE; // ex.: https://predictor-porto-api.predictorporto.workers.dev

function buildTarget(req: NextRequest) {
  const rest = req.nextUrl.pathname.replace(/^\/api\/admin\/?/, ''); // strip prefix
  return `${UPSTREAM}/api/${rest}${req.nextUrl.search}`;
}

async function forward(req: NextRequest) {
  if (!UPSTREAM) return Response.json({ error: 'Server misconfig: API_BASE missing' }, { status: 500 });

  const headers = new Headers(req.headers);
  headers.set('cache-control', 'no-store');

  const adminKey = process.env.ADMIN_KEY;
  if (adminKey) headers.set('x-admin-key', adminKey);

  const init: RequestInit = {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : (await req.blob()) as any,
    cache: 'no-store',
    redirect: 'manual'
  };

  const upstream = await fetch(buildTarget(req), init);
  const resHeaders = new Headers();
  upstream.headers.forEach((v, k) => { if (k.toLowerCase() !== 'content-encoding') resHeaders.set(k, v); });
  const body = await upstream.arrayBuffer();
  return new Response(body, { status: upstream.status, headers: resHeaders });
}

export async function GET(req: NextRequest, _ctx: any)    { return forward(req); }
export async function POST(req: NextRequest, _ctx: any)   { return forward(req); }
export async function PATCH(req: NextRequest, _ctx: any)  { return forward(req); }
export async function PUT(req: NextRequest, _ctx: any)    { return forward(req); }
export async function DELETE(req: NextRequest, _ctx: any) { return forward(req); }
