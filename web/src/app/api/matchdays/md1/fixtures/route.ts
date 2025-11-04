export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const base = process.env.API_BASE!;
  const upstream = `${base}/api/matchdays/md1/fixtures`;
  const res = await fetch(upstream, { cache: 'no-store', headers: { accept: 'application/json' } });
  const body = await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' }
  });
}
