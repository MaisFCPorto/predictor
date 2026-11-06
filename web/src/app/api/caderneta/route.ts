import { canReadCaderneta } from '@/features/caderneta/access';
import { readCadernetaDocument } from '@/features/caderneta/document';

export const dynamic = 'force-dynamic';

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };

export async function HEAD(request: Request) {
  const allowed = await canReadCaderneta(request.headers.get('Authorization'));
  return new Response(null, { status: allowed ? 204 : 404, headers: privateHeaders });
}

export async function GET(request: Request) {
  if (!(await canReadCaderneta(request.headers.get('Authorization')))) {
    return new Response(null, { status: 404, headers: privateHeaders });
  }

  return new Response(await readCadernetaDocument(), {
    headers: {
      ...privateHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
