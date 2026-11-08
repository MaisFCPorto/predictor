import { cadernetaBetaEnabled } from '@/features/caderneta/access';
import { canReadHub } from '@/features/hub/access';
import { hubSnapshot } from '@/features/hub/snapshot';
import type { HubContent } from '@/features/hub/types';

export const dynamic = 'force-dynamic';

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };

export async function GET(request: Request) {
  if (!(await canReadHub(request.headers.get('Authorization')))) {
    return new Response(null, { status: 404, headers: privateHeaders });
  }

  const content: HubContent = { ...hubSnapshot, cadernetaEnabled: cadernetaBetaEnabled() };
  return Response.json(content, { headers: privateHeaders });
}
