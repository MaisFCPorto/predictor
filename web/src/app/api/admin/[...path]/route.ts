// web/src/app/api/admin/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const API = process.env.NEXT_PUBLIC_API_URL!;
const ADMIN_KEY = process.env.ADMIN_KEY!;

// Constrói URL final no Worker: /api/<resto>
function upstreamUrl(restPath: string) {
  const base = API.replace(/\/+$/, '');
  const path = restPath.replace(/^\/+/, ''); // sem barras no início
  return `${base}/api/${path}`;
}

async function forward(req: NextRequest, restPath: string) {
  if (!API || !ADMIN_KEY) {
    return NextResponse.json(
      { error: 'Server misconfig: NEXT_PUBLIC_API_URL or ADMIN_KEY missing' },
      { status: 500 },
    );
  }

  const url = upstreamUrl(restPath);

  // Clona headers e passa apenas os relevantes
  const headers: Record<string, string> = {
    'X-Admin-Key': ADMIN_KEY,
  };
  // Propaga cookies (se for preciso para o Worker)
  const cookie = req.headers.get('cookie');
  if (cookie) headers['cookie'] = cookie;

  // Body só para métodos com body
  const method = req.method.toUpperCase();
  const hasBody = method === 'POST' || method === 'PATCH' || method === 'PUT';
  const body = hasBody ? await req.text() : undefined;

  const res = await fetch(url, {
    method,
    headers: {
      ...headers,
      ...(hasBody ? { 'content-type': req.headers.get('content-type') || 'application/json' } : {}),
    },
    body,
    cache: 'no-store',
  });

  // Reencaminha resposta tal-e-qual (status e body)
  const text = await res.text();

  // Tenta JSON; se falhar, devolve texto
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    return new NextResponse(text, { status: res.status });
  }
}

// Qualquer método → encaminha
export async function GET(req: NextRequest, ctx: { params: { path?: string[] } }) {
  const rest = (ctx.params.path ?? []).join('/');
  return forward(req, rest);
}
export async function POST(req: NextRequest, ctx: { params: { path?: string[] } }) {
  const rest = (ctx.params.path ?? []).join('/');
  return forward(req, rest);
}
export async function PATCH(req: NextRequest, ctx: { params: { path?: string[] } }) {
  const rest = (ctx.params.path ?? []).join('/');
  return forward(req, rest);
}
export async function PUT(req: NextRequest, ctx: { params: { path?: string[] } }) {
  const rest = (ctx.params.path ?? []).join('/');
  return forward(req, rest);
}
export async function DELETE(req: NextRequest, ctx: { params: { path?: string[] } }) {
  const rest = (ctx.params.path ?? []).join('/');
  return forward(req, rest);
}
