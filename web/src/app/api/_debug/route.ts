// web/src/app/api/_debug/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const upstream = process.env.API_BASE || '';
  const hasAdminKey =
    !!(process.env.API_ADMIN_KEY || process.env.ADMIN_KEY)?.trim();

  return NextResponse.json({
    ok: true,
    upstream,
    hasAdminKey,
    now: new Date().toISOString(),
  });
}
