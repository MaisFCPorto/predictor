import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseBrowser = () =>
  createBrowserClient(url, key);

// PKCE -> usar em TUDO no browser (Google/SSO e leitura de sessão)
export const supabasePKCE = createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true },
});

// (Opcional) clássico para email/password se preferires separar
export const supabaseClassic = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// ⚠️ Não exportes nenhum `supabase` “simples” para não ser usado por engano
