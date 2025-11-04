import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = process.env.API_BASE; // https://predictor-porto-api.predictorporto.workers.dev

function buildTarget(req: NextRequest) {
  const rest = req.nextUrl.pathname.replace(/^\/api\/admin\/?/, '');
  const qs = req.nextUrl.search || '';
  return `${UPSTREAM}/api/admin/${rest}${qs}`;
}

async function forward(req: NextRequest) {
  if (!UPSTREAM) {
    return NextResponse.json({ error: 'Server misconfig: API_BASE missing' }, { status: 500 });
  }

  const target = buildTarget(req);

  const outgoing = new Headers(req.headers);
  outgoing.set('cache-control', 'no-store');

  // envia a chave (Vercel) para o Worker
  const adminKey = (process.env.API_ADMIN_KEY || process.env.ADMIN_KEY || '').trim();
  if (adminKey) outgoing.set('x-admin-key', adminKey);

  const init: RequestInit = {
    method: req.method,
    headers: outgoing,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : (await req.blob()) as any,
    redirect: 'manual',
    cache: 'no-store',
  };

  const upstream = await fetch(target, init);

  const resHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'content-encoding') resHeaders.set(k, v);
  });

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest, _ctx: any)   { return forward(req); }
export async function POST(req: NextRequest, _ctx: any)  { return forward(req); }
export async function PATCH(req: NextRequest, _ctx: any) { return forward(req); }
export async function PUT(req: NextRequest, _ctx: any)   { return forward(req); }
export async function DELETE(req: NextRequest, _ctx: any){ return forward(req); }
