import { cadernetaBetaEnabled } from '@/features/caderneta/access';
import { canReadHub } from '@/features/hub/access';
import { fetchHubNews } from '@/features/hub/news-upstream';
import { hubSnapshot } from '@/features/hub/snapshot';
import type { HubArticle, HubContent } from '@/features/hub/types';

export const dynamic = 'force-dynamic';

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };
const editionFormatter = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'full',
  timeZone: 'Europe/Lisbon',
});

async function loadArticles(): Promise<HubArticle[] | null> {
  try {
    const response = await fetchHubNews('/published');
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!(await canReadHub(request.headers.get('Authorization')))) {
    return new Response(null, { status: 404, headers: privateHeaders });
  }

  const now = new Date();
  const articles = await loadArticles();
  const content: HubContent = {
    ...hubSnapshot,
    edition: { date: now.toISOString(), label: editionFormatter.format(now) },
    articles: articles ?? [],
    newsAvailable: articles !== null,
    cadernetaEnabled: cadernetaBetaEnabled(),
  };
  return Response.json(content, { headers: privateHeaders });
}
