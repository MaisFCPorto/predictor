import { canReadHub } from '@/features/hub/access';

export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, x-hub-news-key' };

export async function GET(request: Request, { params }: { params: Promise<{ source: string }> }) {
  const key = process.env.HUB_NEWS_KEY?.trim();
  const internal = !!key && request.headers.get('x-hub-news-key') === key;
  if (!internal && !(await canReadHub(request.headers.get('Authorization')))) return new Response(null, { status: 404, headers: privateHeaders });
  const { source } = await params;
  if (source !== 'ojogo' && source !== 'jn') return new Response(null, { status: 404, headers: privateHeaders });
  const publisher = source === 'ojogo' ? 'ojogo.pt' : 'jn.pt';
  let target = `https://news.google.com/rss/search?q=${encodeURIComponent('FC Porto site:' + publisher + ' when:7d')}&hl=pt-PT&gl=PT&ceid=PT%3Apt-150`;
  try {
    const signal = AbortSignal.timeout(6_000);
    let response: Response | undefined;
    for (let hop = 0; hop < 3; hop++) {
      response = await fetch(target, { headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'PredictorPorto-News/1.0' }, redirect: 'manual', cache: 'no-store', signal });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const next = new URL(response.headers.get('Location') ?? '', target);
      await response.body?.cancel();
      if (next.origin !== 'https://news.google.com' || hop === 2) throw new Error('unavailable');
      target = next.href;
    }
    if (!response?.ok || !/(?:application|text)\/(?:rss\+)?xml/i.test(response.headers.get('content-type') ?? '')) throw new Error('unavailable');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 1_000_000) throw new Error('unavailable');
    return new Response(bytes, { headers: { ...privateHeaders, 'Content-Type': 'application/rss+xml; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" } });
  } catch { return Response.json({ error: 'feed_unavailable' }, { status: 502, headers: privateHeaders }); }
}
