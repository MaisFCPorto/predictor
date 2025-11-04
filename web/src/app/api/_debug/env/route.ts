import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    API_BASE: process.env.API_BASE ?? null,
    NEXT_PUBLIC_API_URL_BASE: process.env.NEXT_PUBLIC_API_URL_BASE ?? null,
    NODE_ENV: process.env.NODE_ENV ?? null,
  });
}
