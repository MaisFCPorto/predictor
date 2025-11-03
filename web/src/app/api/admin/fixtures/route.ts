// web/src/app/api/admin/fixtures/route.ts  (GET → lista)
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  const res = await fetch(`${base}/api/admin/fixtures`, {
    headers: { 'X-Admin-Key': process.env.ADMIN_KEY || process.env.API_ADMIN_KEY || '' },
    cache: 'no-store',
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'application/json' } });
}
