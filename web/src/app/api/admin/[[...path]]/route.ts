// web/src/app/api/admin/[[...path]]/route.ts
export const dynamic = 'force-dynamic';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE ||
  '';

const ADMIN_KEY =
  process.env.ADMIN_KEY ||
  process.env.API_ADMIN_KEY ||
  '';

async function forward(req: Request, pathSegs: string[]) {
  if (!API_BASE || !ADMIN_KEY) {
    return new Response(
      JSON.stringify({ error: 'Server misconfig: NEXT_PUBLIC_API_URL or ADMIN_KEY missing' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }

  const target = `${API_BASE.replace(/\/+$/, '')}/api/${['admin', ...pathSegs].join('/')}`;

  // clona request mantendo método/body/headers e cookies do browser
  const init: RequestInit = {
    method: req.method,
    headers: new Headers(req.headers),
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.clone().arrayBuffer(),
  };

  // força no-cache e injecta a admin key
  (init.headers as Headers).set('cache-control', 'no-store');
  (init.headers as Headers).set('x-admin-key', ADMIN_KEY);

  const upstream = await fetch(target, init);

  const resHeaders = new Headers();
  for (const [k, v] of upstream.headers) resHeaders.set(k, v);
  // garante content-type json em erros da API
  if (!resHeaders.get('content-type')) resHeaders.set('content-type', 'application/json');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

// ⚠️ sem tipagem no 2.º argumento para agradar ao verificador do Next
export async function GET(req: Request, ctx: any) {
  return forward(req, ctx?.params?.path ?? []);
}
export async function POST(req: Request, ctx: any) {
  return forward(req, ctx?.params?.path ?? []);
}
export async function PATCH(req: Request, ctx: any) {
  return forward(req, ctx?.params?.path ?? []);
}
export async function PUT(req: Request, ctx: any) {
  return forward(req, ctx?.params?.path ?? []);
}
export async function DELETE(req: Request, ctx: any) {
  return forward(req, ctx?.params?.path ?? []);
}
export async function OPTIONS(req: Request, ctx: any) {
  return forward(req, ctx?.params?.path ?? []);
}
