import { canReadHub } from '@/features/hub/access';
import { fetchHubNews } from '@/features/hub/news-upstream';

export const dynamic = 'force-dynamic';

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };

async function forward(request: Request) {
  if (!(await canReadHub(request.headers.get('Authorization')))) {
    return new Response(null, { status: 404, headers: privateHeaders });
  }

  try {
    const upstream = request.method === 'POST'
      ? await fetchHubNews('/sync', { method: 'POST' })
      : request.method === 'PATCH'
        ? await fetchHubNews('', { method: 'PATCH', body: await request.text() })
        : await fetchHubNews(new URL(request.url).search);

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
