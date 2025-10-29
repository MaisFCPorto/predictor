import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );


const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// PKCE -> usar em TUDO no browser (Google/SSO e leitura de sessão)
export const supabasePKCE = createClient(url, anon, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true },
});

// (Opcional) clássico para email/password se preferires separar
export const supabaseClassic = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// ⚠️ Não exportes nenhum `supabase` “simples” para não ser usado por engano
