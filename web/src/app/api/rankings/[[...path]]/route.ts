import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = process.env.API_BASE || process.env.NEXT_PUBLIC_API_URL_BASE;

function buildTarget(req: NextRequest) {
  const rest = req.nextUrl.pathname.replace(/^\/api\/rankings\/?/, '');
  const qs = req.nextUrl.search || '';
  return `${UPSTREAM}/api/rankings/${rest}${qs}`;
}

async function forward(req: NextRequest) {
  if (!UPSTREAM) return NextResponse.json({ error: 'API_BASE missing' }, { status: 500 });

  const init: RequestInit = {
    method: req.method,
    headers: req.headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : (await req.blob()) as any,
    cache: 'no-store',
    redirect: 'manual',
  };

  const upstream = await fetch(buildTarget(req), init);
  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  upstream.headers.forEach((v, k) => { if (k !== 'content-encoding') headers.set(k, v); });
  return new NextResponse(body, { status: upstream.status, statusText: upstream.statusText, headers });
}

export async function GET(req: NextRequest, _ctx: any)    { return forward(req); }
export async function POST(req: NextRequest, _ctx: any)   { return forward(req); }
export async function PATCH(req: NextRequest, _ctx: any)  { return forward(req); }
export async function PUT(req: NextRequest, _ctx: any)    { return forward(req); }
export async function DELETE(req: NextRequest, _ctx: any) { return forward(req); }
