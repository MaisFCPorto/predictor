import { NextResponse, type NextRequest } from 'next/server';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();

function workerUrl(leagueId: string) {
  const base = API_BASE ? API_BASE.replace(/\/+$/, '') : '';
  return `${base}/api/leagues/${encodeURIComponent(leagueId)}/ranking`;
}

export async function GET(
  _req: NextRequest,
  context: { params: { leagueId: string } },
) {
  const { leagueId } = context.params;

  if (!leagueId) {
    return NextResponse.json({ error: 'missing_league_id' }, { status: 400 });
  }

  try {
    const url = workerUrl(leagueId);
    const res = await fetch(url, {
      headers: { 'cache-control': 'no-store' },
    });

    const text = await res.text();
    const contentType =
      res.headers.get('content-type') || 'application/json; charset=utf-8';

    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': contentType },
    });
  } catch (e: any) {
    console.error('Error fetching league ranking from worker:', e);
    return NextResponse.json(
      { error: 'league_ranking_fetch_failed' },
      { status: 500 },
    );
  }
}
