// web/src/app/api/fixtures/[fixtureId]/trends/route.ts
import { NextResponse } from 'next/server';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();

export async function GET(_req: Request, context: any) {
  const fixtureId = context?.params?.fixtureId as string | undefined;

  if (!fixtureId) {
    return NextResponse.json(
      { error: 'missing_fixtureId' },
      { status: 400 },
    );
  }

  if (!API_BASE) {
    return NextResponse.json(
      { error: 'missing_api_base' },
      { status: 500 },
    );
  }

  const base = API_BASE.replace(/\/+$/, '');
  const url = `${base}/api/fixtures/${encodeURIComponent(
    fixtureId,
  )}/trends`;

  const upstream = await fetch(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });

  const text = await upstream.text();

  if (!upstream.ok) {
    return new NextResponse(text || '{"error":"upstream_error"}', {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ??
          'application/json; charset=utf-8',
      },
    });
  }

  return new NextResponse(text, {
    status: 200,
    headers: {
      'content-type':
        upstream.headers.get('content-type') ??
        'application/json; charset=utf-8',
    },
  });
}
