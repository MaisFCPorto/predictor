import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const API = process.env.NEXT_PUBLIC_API_URL!;
const ADMIN_KEY = process.env.ADMIN_KEY!;

function upstreamUrl(restPath: string) {
  const base = API?.replace(/\/+$/, '') ?? '';
  const path = (restPath || '').replace(/^\/+/, '');
  return `${base}/api/${path}`;           // ex: https://.../api/teams
}

async function forward(req: Request, restPath: string) {
  if (!API || !ADMIN_KEY) {
    return NextResponse.json(
      { error: 'Server misconfig: NEXT_PUBLIC_API_URL or ADMIN_KEY missing' },
      { status: 500 },
    );
  }

  const url = upstreamUrl(restPath);
  const method = req.method.toUpperCase();
  const hasBody = /^(POST|PUT|PATCH)$/i.test(method);
  const body = hasBody ? await req.text() : undefined;

  const headers: Record<string, string> = { 'X-Admin-Key': ADMIN_KEY };
  const cookie = req.headers.get('cookie');
  if (cookie) headers.cookie = cookie;

  const res = await fetch(url, {
    method,
    headers: {
      ...headers,
      ...(hasBody ? { 'content-type': req.headers.get('content-type') || 'application/json' } : {}),
    },
    body,
    cache: 'no-store',
  });

  const text = await res.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    return new NextResponse(text, { status: res.status });
  }
}

function seg(ctx: any) {
  // para [[...path]] pode ser undefined
  const arr = (ctx?.params?.path ?? []) as string[];
  return arr.join('/');
}

export async function GET(req: Request, ctx: any)    { return forward(req, seg(ctx)); }
export async function POST(req: Request, ctx: any)   { return forward(req, seg(ctx)); }
export async function PATCH(req: Request, ctx: any)  { return forward(req, seg(ctx)); }
export async function PUT(req: Request, ctx: any)    { return forward(req, seg(ctx)); }
export async function DELETE(req: Request, ctx: any) { return forward(req, seg(ctx)); }
