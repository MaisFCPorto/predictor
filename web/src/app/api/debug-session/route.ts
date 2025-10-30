/* apps/web/src/app/api/debug-session/route.ts */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic'; // evita cache em produção

export async function GET() {
  const cookieStore = await cookies(); // 👈 precisa de await

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {}, // no-op
        remove: () => {}, // no-op
      },
    }
  );

  const { data: { session }, error } = await supabase.auth.getSession();

  // lista os nomes de cookies para debug
  const cookieNames = (await cookieStore.getAll()).map((c: any) => c.name);

  return NextResponse.json(
    { cookieNames, hasSession: !!session, session, error },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
