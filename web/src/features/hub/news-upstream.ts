import 'server-only';

export function fetchHubNews(suffix: string, init?: { method: 'POST' | 'PATCH'; body?: string }) {
  const base = (
    process.env.API_BASE?.trim() || process.env.NEXT_PUBLIC_API_BASE?.trim() || ''
  ).replace(/\/+$/, '');
  const key = process.env.HUB_NEWS_KEY?.trim();
  if (!base || !key) throw new Error('Hub news upstream is unavailable');

  const headers = new Headers({ 'x-hub-news-key': key });
  if (init?.body !== undefined) headers.set('content-type', 'application/json');
  return fetch(`${base}/api/internal/hub-news${suffix}`, {
    ...init,
    headers,
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(suffix === '/sync' ? 45_000 : suffix === '/summaries' ? 30_000 : 12_000),
  });
}
