// web/src/app/api/admin/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const API = process.env.NEXT_PUBLIC_API_URL!;
const ADMIN_KEY = process.env.ADMIN_KEY!;

function upstreamUrl(restPath: string) {
  const base = API.replace(/\/+$/, '');
  const path = restPath.replace(/^\/+/, '');
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
  const method = req.method.toUpperCase();
  const hasBody = method === 'POST' || method === 'PATCH' || method === 'PUT';
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

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const rest = (params?.path ?? []).join('/');
  return forward(req, rest);
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const rest = (params?.path ?? []).join('/');
  return forward(req, rest);
}
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  const rest = (params?.path ?? []).join('/');
  return forward(req, rest);
}
export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  const rest = (params?.path ?? []).join('/');
  return forward(req, rest);
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  const rest = (params?.path ?? []).join('/');
  return forward(req, rest);
}
