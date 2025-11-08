import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL_BASE;

function target(req: NextRequest) {
  const qs = req.nextUrl.search || '';
  return `${UPSTREAM}/api/fixtures/closed${qs}`;
}

export async function GET(req: NextRequest) {
  if (!UPSTREAM) return NextResponse.json({ error:'API_BASE missing' }, { status:500 });
  const url = target(req);
  try {
    const r = await fetch(url, { cache:'no-store', headers:{ accept:'application/json' } });
    const buf = await r.arrayBuffer();
    const h = new Headers();
    r.headers.forEach((v,k)=>{ if(k!=='content-encoding') h.set(k,v); });
    if (!r.ok) {
      const snip = Buffer.from(buf).toString('utf8').slice(0,200);
      return NextResponse.json({ where:'/api/fixtures/closed', upstream:url, status:r.status, snippet:snip }, { status:r.status });
    }
    return new NextResponse(buf, { status:r.status, headers:h });
  } catch (e:any) {
    return NextResponse.json({ where:'/api/fixtures/closed', upstream:url, error:String(e?.message || e) }, { status: 500 });
  }
}
