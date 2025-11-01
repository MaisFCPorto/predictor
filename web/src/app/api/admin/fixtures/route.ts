// web/src/app/api/admin/fixtures/route.ts
import { NextRequest, NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL!;
const ADMIN = process.env.ADMIN_KEY!;

// Reencaminha QUALQUER método para o Worker, acrescentando o X-Admin-Key.
// Mantém query string, body e content-type. Sem cache.
async function forward(req: NextRequest) {
  const url = new URL(req.url);
  const target = `${API}/api/admin/fixtures${url.search}`;

  const init: RequestInit = {
    method: req.method,
    headers: {
      'X-Admin-Key': ADMIN,
      // content-type só quando há body; o fetch copia o restante se precisares
      ...(req.headers.get('content-type')
        ? { 'content-type': req.headers.get('content-type')! }
        : {}),
    },
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await req.text();
    init.body = body;
  }

  const res = await fetch(target, init);

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
    },
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
