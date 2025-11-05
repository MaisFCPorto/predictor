export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const base =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE;

  const adminKey =
    process.env.ADMIN_KEY ||           // <- preferir este nome
    process.env.API_ADMIN_KEY;         // <- fallback se usaste este

  if (!base) {
    return new Response(
      JSON.stringify({ error: 'server_misconfig', hint: 'Define NEXT_PUBLIC_API_URL (ou NEXT_PUBLIC_API_BASE) na Vercel.' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
  if (!adminKey) {
    return new Response(
      JSON.stringify({ error: 'server_misconfig', hint: 'Define ADMIN_KEY (ou API_ADMIN_KEY) na Vercel, igual à chave esperada no Worker.' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }

  const upstream = `${base.replace(/\/$/, '')}/api/admin/teams`;
  try {
    const res = await fetch(upstream, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'X-Admin-Key': adminKey,
      },
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'upstream_fetch_failed', message: err?.message ?? String(err), upstream }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
