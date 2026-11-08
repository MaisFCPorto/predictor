import 'server-only';

import { createClient } from '@supabase/supabase-js';

export async function getPredictorAdminId(authorization: string | null): Promise<string | null> {
  const token = authorization?.match(/^Bearer (\S+)$/i)?.[1];
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiBase = (
    process.env.API_BASE?.trim() || process.env.NEXT_PUBLIC_API_BASE?.trim() || ''
  ).replace(/\/+$/, '');

  if (!token || !url || !key || !apiBase) return null;

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;

    const roleResponse = await fetch(
      `${apiBase}/api/users/${encodeURIComponent(data.user.id)}/role`,
      { cache: 'no-store' }
    );
    if (!roleResponse.ok) return null;

    const result: { role?: unknown } | null = await roleResponse.json();
    return result?.role === 'admin' ? data.user.id : null;
  } catch {
    return null;
  }
}

export async function isPredictorAdmin(authorization: string | null) {
  return (await getPredictorAdminId(authorization)) !== null;
}
