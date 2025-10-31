import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!; // ex: https://predictor-porto-api....workers.dev

export async function GET(req: Request) {
  // reencaminha cookies do utilizador para o backend
  const cookie = req.headers.get('cookie') ?? '';
  const r = await fetch(`${API_BASE}/api/auth/me`, {
    method: 'GET',
    headers: { cookie, 'x-forwarded-host': new URL(req.url).host },
    // NOTA: em ambiente server fetch, credentials não tem efeito — passamos os cookies manualmente acima
  });

  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
  });
}
