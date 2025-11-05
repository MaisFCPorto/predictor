export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = process.env.API_BASE!;

export async function GET(_req: Request, context: any) {
  if (!UPSTREAM) {
    return new Response(JSON.stringify({ error: 'API_BASE missing' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const id = context.params?.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'missing_id' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const url = `${UPSTREAM}/api/users/role/${encodeURIComponent(id)}`;

  const upstream = await fetch(url, { method: 'GET', cache: 'no-store' });

  const headers = new Headers();
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'content-encoding') headers.set(k, v);
  });

  const buf = await upstream.arrayBuffer();
  return new Response(buf, { status: upstream.status, headers });
}
