export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const baseEnv = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8787';
  try {
    const baseUrl = new URL(baseEnv);
    const upstream = `${baseUrl.origin.replace(/\/$/, '')}/api/fixtures/open`;
    const res = await fetch(upstream, { cache: 'no-store', headers: { accept: 'application/json' } });
    const body = await res.arrayBuffer();
    return new Response(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'API_BASE is not a valid URL', detail: String(e?.message || e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
