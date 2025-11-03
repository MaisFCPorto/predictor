export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const base =
    process.env.NEXT_PUBLIC_API_URL || // <- usa esta se existir
    process.env.NEXT_PUBLIC_API_BASE;  // <- fallback

  if (!base) {
    return new Response(
      JSON.stringify({
        error: 'server_misconfig',
        hint: 'Define NEXT_PUBLIC_API_URL (ou NEXT_PUBLIC_API_BASE) na Vercel.',
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }

  const upstream = `${base.replace(/\/$/, '')}/api/fixtures/open`;

  try {
    const res = await fetch(upstream, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });

    const text = await res.text(); // pass-through do body
    return new Response(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: 'upstream_fetch_failed',
        message: err?.message ?? String(err),
        upstream,
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
