import { canReadHub } from '@/features/hub/access';
import { fetchHubNews } from '@/features/hub/news-upstream';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canReadHub(request.headers.get('Authorization')))) return new Response(null, { status: 404, headers });
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return new Response(null, { status: 404, headers });
  try {
    const upstream = await fetchHubNews('/article/' + id);
    if (upstream.status >= 500 || !upstream.headers.get('content-type')?.includes('application/json')) throw new Error('unavailable');
    return new Response(upstream.body, { status: upstream.status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
  } catch {
    return Response.json({ error: 'news_unavailable' }, { status: 502, headers });
  }
}
