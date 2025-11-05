export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const UPSTREAM = process.env.API_BASE; // mesmo de cima

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  if (!UPSTREAM) return NextResponse.json({ error: 'API_BASE missing' }, { status: 500 });

  const id = ctx.params?.id;
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  // no worker tens AMBAS as rotas: /api/users/:id/role e /api/users/role/:id
  // usa a segunda para bater certo com o teu AdminGate:
  const url = `${UPSTREAM}/api/users/role/${encodeURIComponent(id)}`;

  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.arrayBuffer();

  const headers = new Headers();
  res.headers.forEach((v, k) => { if (k.toLowerCase() !== 'content-encoding') headers.set(k, v); });

  return new NextResponse(data, { status: res.status, statusText: res.statusText, headers });
}
