import { hubBetaEnabled } from '@/features/hub/access';
import { getPredictorAdminId } from '@/utils/supabase/predictor-admin';

export const dynamic = 'force-dynamic';

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };

async function forward(request: Request, { params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  if (!hubBetaEnabled() || (area !== 'plantel' && area !== 'notas') ||
      (area === 'plantel' && request.method !== 'GET')) {
    return new Response(null, { status: 404, headers: privateHeaders });
  }
  const userId = await getPredictorAdminId(request.headers.get('Authorization'));
  if (!userId) return new Response(null, { status: 404, headers: privateHeaders });

  try {
    const base = (process.env.API_BASE?.trim() || process.env.NEXT_PUBLIC_API_BASE?.trim() || '').replace(/\/+$/, '');
    const key = process.env.HUB_NEWS_KEY?.trim();
    if (!base || !key) throw new Error('Hub Worker is unavailable');

    const fixture = new URL(request.url).searchParams.get('jogo');
    const search = fixture === null ? '' : `?${new URLSearchParams({ jogo: fixture })}`;
    const headers = new Headers({ 'x-hub-news-key': key, 'x-hub-user-id': userId });
    const body = request.method === 'GET' ? undefined : await request.text();
    if (body !== undefined) {
      if (body.length > 8192) return Response.json({ error: 'invalid_request' }, { status: 400, headers: privateHeaders });
      headers.set('Content-Type', 'application/json');
    }

    const upstream = await fetch(`${base}/api/internal/hub-fans/${area}${search}`, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    });
    if (upstream.status >= 500) throw new Error('Hub Worker request failed');
    const outgoing = new Headers(privateHeaders);
    const type = upstream.headers.get('Content-Type');
    if (type) outgoing.set('Content-Type', type);
    return new Response(upstream.body, { status: upstream.status, headers: outgoing });
  } catch {
    return Response.json({ error: 'fans_unavailable' }, { status: 502, headers: privateHeaders });
  }
}

export { forward as GET, forward as POST, forward as PUT };
