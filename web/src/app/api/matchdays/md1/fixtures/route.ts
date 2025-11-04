import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = process.env.API_BASE || process.env.NEXT_PUBLIC_API_URL_BASE;

function target(req: NextRequest) {
  const rest = req.nextUrl.pathname.replace(/^\/api\/rankings\/?/, '');
  const qs = req.nextUrl.search || '';
  return `${UPSTREAM}/api/rankings/${rest}${qs}`;
}

async function forward(req: NextRequest) {
  if (!UPSTREAM) return NextResponse.json({ error:'API_BASE missing' }, { status:500 });
  const url = target(req);

  try {
    const init: RequestInit = {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : (await req.blob()) as any,
      cache: 'no-store',
      redirect: 'manual',
    };

    const r = await fetch(url, init);
    const buf = await r.arrayBuffer();
    const h = new Headers();
    r.headers.forEach((v,k)=>{ if(k!=='content-encoding') h.set(k,v); });

    if (!r.ok || !h.get('content-type')?.includes('application/json')) {
      const snip = Buffer.from(buf).toString('utf8').slice(0,200);
      return NextResponse.json({ where:'/api/rankings', upstream:url, status:r.status, contentType:h.get('content-type'), snippet:snip }, { status:r.status });
    }
    return new NextResponse(buf, { status:r.status, headers:h });
  } catch (e:any) {
    return NextResponse.json({ where:'/api/rankings', upstream:url, error:String(e?.message || e) }, { status:500 });
  }
}

export async function GET(req: NextRequest, _ctx:any){ return forward(req); }
export async function POST(req: NextRequest, _ctx:any){ return forward(req); }
export async function PATCH(req: NextRequest, _ctx:any){ return forward(req); }
export async function PUT(req: NextRequest, _ctx:any){ return forward(req); }
export async function DELETE(req: NextRequest, _ctx:any){ return forward(req); }
