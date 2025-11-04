// web/src/app/api/rankings/[[...path]]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = process.env.API_BASE || process.env.NEXT_PUBLIC_API_URL_BASE;

function buildTarget(req: NextRequest) {
  // tira o prefixo /api para espelhar no Worker
  const rest = req.nextUrl.pathname.replace(/^\/api\/rankings\/?/, '');
  const qs = req.nextUrl.search || '';
  const base = `${UPSTREAM}/api/rankings`;
  return rest ? `${base}/${rest}${qs}` : `${base}${qs}`;
}

async function forward(req: NextRequest) {
  if (!UPSTREAM) {
    return NextResponse.json({ error: 'API_BASE missing' }, { status: 500 });
  }

  const url = buildTarget(req);
  try {
    const r = await fetch(url, { cache: 'no-store', headers: { accept: 'application/json' } });

    const buf = await r.arrayBuffer();
    const h = new Headers();
    r.headers.forEach((v, k) => { if (k.toLowerCase() !== 'content-encoding') h.set(k, v); });

    // devolve algum contexto se o upstream não devolver JSON
    const isJson = (h.get('content-type') || '').includes('application/json');
    if (!r.ok || !isJson) {
      const snippet = Buffer.from(buf).toString('utf8').slice(0, 200);
      return NextResponse.json(
        { where: '/api/rankings/*', upstream: url, status: r.status, contentType: h.get('content-type'), snippet },
        { status: r.status }
      );
    }
    return new NextResponse(buf, { status: r.status, headers: h });
  } catch (e: any) {
    return NextResponse.json({ where: '/api/rankings/*', upstream: url, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest)    { return forward(req); }
export async function POST(req: NextRequest)   { return forward(req); }
export async function PATCH(req: NextRequest)  { return forward(req); }
export async function PUT(req: NextRequest)    { return forward(req); }
export async function DELETE(req: NextRequest) { return forward(req); }
