// Roteador/proxy genérico para /api/admin/*
// Encaminha para o Worker:  <NEXT_PUBLIC_API_URL>/api/admin/:path
// Junta query string, passa body e acrescenta o X-Admin-Key do servidor.

import { NextRequest, NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL!;
const ADMIN_KEY = process.env.ADMIN_KEY!;

function targetUrl(req: NextRequest, path: string[]) {
  const qs = req.nextUrl.search; // inclui ?...
  return `${API.replace(/\/$/, '')}/api/admin/${(path ?? []).join('/')}${qs}`;
}

// Copia apenas cabeçalhos úteis de volta
function pickResponseHeaders(from: Headers) {
  const out = new Headers();
  for (const [k, v] of from.entries()) {
    const kl = k.toLowerCase();
    if (
      kl === 'content-type' ||
      kl === 'content-length' ||
      kl === 'cache-control' ||
      kl === 'etag' ||
      kl === 'last-modified' ||
      kl === 'set-cookie'
    ) {
      // set-cookie pode repetir
      if (kl === 'set-cookie') out.append(k, v);
      else out.set(k, v);
    }
  }
  return out;
}

async function forward(req: NextRequest, path: string[]) {
  if (!API || !ADMIN_KEY) {
    return NextResponse.json(
      { error: 'Server misconfig: NEXT_PUBLIC_API_URL or ADMIN_KEY missing' },
      { status: 500 },
    );
  }

  const url = targetUrl(req, path);
  const headers = new Headers(req.headers);

  // força o admin key no pedido a montante
  headers.set('x-admin-key', ADMIN_KEY);
  headers.delete('host'); // evita problemas de host header

  // body só quando não for GET/HEAD
  const body =
    req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body,
    redirect: 'manual',
    cache: 'no-store',
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: pickResponseHeaders(upstream.headers),
  });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path ?? []);
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path ?? []);
}
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path ?? []);
}
export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path ?? []);
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path ?? []);
}
export async function OPTIONS(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path ?? []);
}
