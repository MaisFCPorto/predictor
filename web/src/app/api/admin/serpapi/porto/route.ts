import { getPredictorAdminId } from '@/utils/supabase/predictor-admin';

export const dynamic = 'force-dynamic';

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };

export async function GET(request: Request) {
  const userId = await getPredictorAdminId(request.headers.get('Authorization'));
  if (!userId) return Response.json({ error: 'forbidden' }, { status: 403, headers: privateHeaders });

  const base = (process.env.API_BASE?.trim() || process.env.NEXT_PUBLIC_API_BASE?.trim() || '').replace(/\/+$/, '');
  const key = process.env.HUB_NEWS_KEY?.trim();
  if (!base || !key) {
    return Response.json({ error: 'serpapi_proxy_not_configured' }, { status: 503, headers: privateHeaders });
  }

  try {
    const target = new URL(base + '/api/internal/hub-fans/serpapi');
    const kgmid = new URL(request.url).searchParams.get('kgmid');
    if (kgmid !== null) target.searchParams.set('kgmid', kgmid);

    const upstream = await fetch(target, {
      headers: { 'x-hub-news-key': key, 'x-hub-user-id': userId },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    const headers = new Headers(privateHeaders);
    const contentType = upstream.headers.get('Content-Type');
    if (contentType) headers.set('Content-Type', contentType);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return Response.json({ error: 'serpapi_unavailable' }, { status: 502, headers: privateHeaders });
  }
}
