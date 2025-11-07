'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabasePKCE } from '@/utils/supabase/client';
import clsx from 'clsx';

export default function AuthPage() {
  const router = useRouter();
  const supabase = supabasePKCE;

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false); // <- NOVO: aceitar regras (só em signup)
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setOk(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/jogos');
      } else {
        // bloqueia se não aceitar as regras
        if (!agree) {
          throw new Error('Tens de aceitar as regras do passatempo para criares conta.');
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              accepted_rules_at: new Date().toISOString(), // guarda registo da aceitação
            },
          },
        });
        if (error) throw error;
        setOk('Conta criada! Verifica o teu email se for necessário confirmar.');
        setMode('login');
        setAgree(false);
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Ocorreu um erro');
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    try {
      setErr(null);
      setLoading(true);
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message ?? 'Falha no login com Google');
      setLoading(false);
    }
  }

  const submitDisabled =
    loading || (mode === 'signup' && (!agree || !email || !password || !name));

  return (
    <main className="mx-auto max-w-lg px-6 py-10 md:py-16">
      <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
        {/* Topo: logo + descrição */}
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center">
            <img
              src="/logobranco.png"
              alt="MaisFCP Predictor"
              className="h-14 w-auto mx-auto mb-2"
            />
          </div>
          <p className="mt-1 text-sm text-white/70">
            Mini-liga de palpites do +FCPorto. Entra, dá os teus palpites, sobe no ranking e habilta-te a fantásticos prémios!
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-5 grid grid-cols-2 gap-2">
          <button
            className={clsx(
              'rounded-full px-4 py-2 text-sm',
              mode === 'login' ? 'bg-white/15' : 'bg-white/8 hover:bg-white/15',
            )}
            onClick={() => setMode('login')}
            disabled={loading}
          >
            Login
          </button>
          <button
            className={clsx(
              'rounded-full px-4 py-2 text-sm',
              mode === 'signup' ? 'bg-white/15' : 'bg-white/8 hover:bg-white/15',
            )}
            onClick={() => setMode('signup')}
            disabled={loading}
          >
            Registo
          </button>
        </div>

        {/* Mensagens */}
        {err && (
          <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {err}
          </div>
        )}
        {ok && (
          <div className="mb-3 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {ok}
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="mb-1 block text-xs text-white/70">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
                placeholder="O teu nome"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-white/70">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              placeholder="email@exemplo.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/70">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              placeholder="••••••••"
            />
          </div>

          {/* Checkbox de aceitação das regras (só em signup) */}
          {mode === 'signup' && (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <input
                id="agree"
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/20"
                aria-describedby="agree-help"
              />
              <label htmlFor="agree" className="text-sm leading-5">
                Declaro que li e aceito as{' '}
                <a
                  href="/regras"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white/90"
                >
                  regras do passatempo
                </a>.
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={submitDisabled}
            className={clsx(
              'mt-2 w-full rounded-xl px-4 py-2 font-medium transition-colors',
              submitDisabled
                ? 'cursor-not-allowed bg-white/10 text-white/60'
                : 'bg-white/15 hover:bg-white/20',
            )}
          >
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-white/50">ou continuar com</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Google OAuth */}
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className={clsx(
            'flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10',
            loading && 'cursor-not-allowed opacity-60',
          )}
        >
          <GoogleIcon />
          Entrar com Google
        </button>

        {/* Rodapé mini */}
        <div className="mt-6 flex flex-col items-center gap-1 pb-2">
          <img
            src="/logos/predictor-02.svg"
            alt="Betano"
            className="h-7 w-auto pointer-events-none select-none opacity-95"
          />
        </div>
      </div>
    </main>
  );
}

/* G colorido minimalista */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4-5.4 4-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .7 3.7 1.3l2.5-2.5C16.8 3.6 14.6 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12s4.2 9.3 9.3 9.3c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.1-1.6H12z"
      />
    </svg>
  );
}
