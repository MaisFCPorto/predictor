'use client';
import { SupabaseClient } from '@supabase/supabase-js';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export async function syncUserToD1(supa: SupabaseClient) {
  const { data: { user } } = await supa.auth.getUser();
  if (!user) throw new Error('user_missing');

  const name =
    user.user_metadata?.name ??
    user.user_metadata?.full_name ??
    user.user_metadata?.user_name ??
    (user.email ? user.email.split('@')[0] : null);

  const avatar_url =
    user.user_metadata?.avatar_url ??
    user.user_metadata?.picture ??
    null;

  await fetch(`${API_BASE}/api/users/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: user.id,
      email: user.email ?? null,
      name: name ?? null,
      avatar_url,
    }),
  });
}
