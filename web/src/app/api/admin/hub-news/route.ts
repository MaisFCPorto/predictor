import { canReadHub } from '@/features/hub/access';
import { fetchHubNews } from '@/features/hub/news-upstream';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };

async function forward(request: Request) {
  if (!(await canReadHub(request.headers.get('Authorization')))) {
    return new Response(null, { status: 404, headers: privateHeaders });
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    if (action && !['add', 'context', 'summary', 'summaries', 'settings'].includes(action)) {
      return Response.json({ error: 'invalid_action' }, { status: 400, headers: privateHeaders });
    }
    if (action === 'context' || action === 'summary' || action === 'summaries' || action === 'settings') {
      const method = action === 'settings' ? 'GET' : action === 'summaries' ? 'POST' : 'PATCH';
      if (request.method !== method) return new Response(null, { status: 405, headers: privateHeaders });
      const body = method === 'GET' ? undefined : await request.text();
      if (body && body.length > 16_000) return Response.json({ error: 'invalid_request' }, { status: 400, headers: privateHeaders });
      const upstream = await fetchHubNews(action === 'settings' ? '/summary-settings' : `/${action}`,
        method === 'GET' ? undefined : { method, body });
      if (!upstream.headers.get('content-type')?.includes('application/json')) throw new Error('Hub news Worker request failed');
      return new Response(upstream.body, { status: upstream.status,
        headers: { ...privateHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
    }
    const upstream = request.method === 'POST'
      ? url.searchParams.get('action') === 'add'
        ? await fetchHubNews('', { method: 'POST', body: await request.text() })
        : await fetchHubNews('/sync', { method: 'POST' })
      : request.method === 'PATCH'
        ? await fetchHubNews('', { method: 'PATCH', body: await request.text() })
        : await fetchHubNews(url.search);

    if (upstream.status >= 500 || !upstream.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Hub news Worker request failed');
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...privateHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch {
    return Response.json({ error: 'news_unavailable' }, { status: 502, headers: privateHeaders });
  }
}

export { forward as GET, forward as POST, forward as PATCH };
