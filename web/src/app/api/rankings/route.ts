export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const UPSTREAM = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export async function GET(req: NextRequest) {
  if (!UPSTREAM) {
    return NextResponse.json({ error: 'API_BASE missing' }, { status: 500 });
  }

  try {
    const url = `${UPSTREAM}/api/rankings${req.nextUrl.search || ''}`;
    const r = await fetch(url, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });

    // lê o conteúdo como texto e força JSON se possível
    const contentType = r.headers.get('content-type') || '';
    const buf = await r.arrayBuffer();
    const txt = Buffer.from(buf).toString('utf8');

    if (!r.ok) {
      return NextResponse.json({ status: r.status, error: txt.slice(0, 200) }, { status: r.status });
    }

    if (!contentType.includes('application/json')) {
      // tenta fazer parse manual do texto
      try {
        const data = JSON.parse(txt);
        return NextResponse.json(data, { status: 200 });
      } catch {
        return NextResponse.json({ error: 'Invalid JSON', preview: txt.slice(0, 200) }, { status: 500 });
      }
    }

    // devolve JSON decodificado
    const json = JSON.parse(txt);
    return NextResponse.json(json, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
