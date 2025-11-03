export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const base = process.env.NEXT_PUBLIC_API_BASE!; // ex.: https://predictor-porto-api.predictorporto.workers.dev
  const upstream = `${base}/api/fixtures/open`;

  const res = await fetch(upstream, { cache: 'no-store', headers: { accept: 'application/json' } });
  const body = await res.text();

  return new Response(body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
