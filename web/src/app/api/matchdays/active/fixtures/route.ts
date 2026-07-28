import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM =
  process.env.API_BASE ||
  process.env.NEXT_PUBLIC_API_URL_BASE ||
  process.env.NEXT_PUBLIC_API_BASE;

export async function GET(req: NextRequest) {
  if (!UPSTREAM) {
    return NextResponse.json(
      { error: 'API_BASE missing' },
      { status: 500 },
    );
  }

  const base = UPSTREAM.replace(/\/$/, '');
  const url =
    `${base}/api/matchdays/active/fixtures` +
    `${req.nextUrl.search || ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
      },
    });

    const body = await response.arrayBuffer();
    const headers = new Headers();

    response.headers.forEach((value, key) => {
      if (key !== 'content-encoding') {
        headers.set(key, value);
      }
    });

    return new NextResponse(body, {
      status: response.status,
      headers,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: String(error?.message || error),
        upstream: url,
      },
      { status: 500 },
    );
  }
}
