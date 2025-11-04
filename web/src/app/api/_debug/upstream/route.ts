import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const UPSTREAM = process.env.API_BASE || process.env.NEXT_PUBLIC_API_URL_BASE;
  if (!UPSTREAM) return NextResponse.json({ ok:false, err:'API_BASE missing' }, { status:500 });

  const url = `${UPSTREAM}/api/fixtures/open`; // algo que sabes que existe
  try {
    const r = await fetch(url, { cache:'no-store', headers:{ accept:'application/json' } });
    const text = await r.text();
    return NextResponse.json({
      ok: r.ok,
      status: r.status,
      url,
      contentType: r.headers.get('content-type'),
      bodySnippet: text.slice(0, 200)
    }, { status: r.ok ? 200 : r.status });
  } catch (e:any) {
    return NextResponse.json({ ok:false, url, err: String(e?.message || e) }, { status: 500 });
  }
}
