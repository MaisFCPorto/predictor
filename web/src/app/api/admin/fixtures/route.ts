import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL;
    const adminKey = process.env.ADMIN_KEY;

    if (!base || !adminKey) {
      return NextResponse.json(
        { error: 'Server misconfig: NEXT_PUBLIC_API_URL or ADMIN_KEY missing' },
        { status: 500 }
      );
    }

    const res = await fetch(`${base}/api/admin/fixtures`, {
      headers: { 'X-Admin-Key': adminKey },
      cache: 'no-store',
    });

    // Repassa status/erro do Worker para ser visível no browser
    const text = await res.text();
    const body = (() => { try { return JSON.parse(text); } catch { return text; } })();

    return NextResponse.json(body as any, { status: res.status });
  } catch (e: any) {
    console.error('GET /api/admin/fixtures failed:', e?.message || e);
    return NextResponse.json(
      { error: e?.message || 'internal error' },
      { status: 500 }
    );
  }
}
