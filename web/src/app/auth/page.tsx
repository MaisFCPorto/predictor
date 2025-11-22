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

  const [agree, setAgree] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Recuperação de password
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotErr, setForgotErr] = useState<string | null>(null);

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
        if (!agree) throw new Error('Tens de aceitar as regras do passatempo.');
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              accepted_rules_at: new Date().toISOString(),
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
      if (mode === 'signup' && !agree) {
        throw new Error('Para continuares com Google no registo, tens de aceitar as regras.');
      }

      setLoading(true);

      if (mode === 'signup') {
        sessionStorage.setItem('accepted_rules_at', new Date().toISOString());
      }

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

  async function sendResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotErr(null);
    setForgotMsg(null);

    const email = forgotEmail.trim();
    if (!email) {
      setForgotErr('Introduz o teu email.');
      return;
    }

    setForgotLoading(true);
    try {
      const redirectTo =
        `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        setForgotErr(error.message || 'Não foi possível enviar o email.');
      } else {
        setForgotMsg('Se existir uma conta com esse email, enviámos um link de recuperação.');
      }
    } catch (e: any) {
      setForgotErr(e?.message || 'Erro ao enviar email.');
    } finally {
      setForgotLoading(false);
    }
  }

  const submitDisabled =
    loading || (mode === 'signup' && (!agree || !email || !password || !name));

  return (
    <main className="mx-auto max-w-lg px-6 py-10 md:py-16">
      <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">

        {/* Logo e descrição */}
        <div className="mb-6 text-center">
          <img src="/logobranco.png" className="h-14 mx-auto mb-2" />
          <p className="mt-1 text-sm text-white/70">
            Mini-liga de palpites do +FCPorto.
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

        {/* Form Login/Signup */}
        <form onSubmit={onSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="mb-1 block text-xs text-white/70">Nome</label>
              <input
                type="text"
                value={name}
                required
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-white/70">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/70">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2"
            />
          </div>

          {/* Aceitação regras */}
          {mode === 'signup' && (
            <div className="mt-3 flex items-start gap-3 text-xs">
              <input
                id="agree"
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/20"
              />
              <label htmlFor="agree" className="text-sm leading-5">
                Declaro que aceito as{' '}
                <a href="/regras" target="_blank" className="underline">
                  regras do passatempo
                </a>.
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={submitDisabled}
            className={clsx(
              'mt-2 w-full rounded-xl px-4 py-2 font-medium',
              submitDisabled
                ? 'cursor-not-allowed bg-white/10 text-white/60'
                : 'bg-white/15 hover:bg-white/20',
            )}
          >
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        {/* Link recuperar password */}
        {mode === 'login' && (
          <div className="mt-2 text-right">
            <button
              className="text-xs underline text-white/60 hover:text-white"
              onClick={() => setForgotOpen((v) => !v)}
            >
              Esqueci-me da password
            </button>
          </div>
        )}

        {/* Bloco recuperação */}
        {forgotOpen && (
          <form
            onSubmit={sendResetPassword}
            className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <p className="text-xs text-white/70">
              Introduz o teu email para receberes um link de recuperação.
            </p>

            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm"
              placeholder="email@exemplo.com"
            />

            {forgotErr && (
              <p className="text-xs text-red-300">{forgotErr}</p>
            )}
            {forgotMsg && (
              <p className="text-xs text-emerald-300">{forgotMsg}</p>
            )}

            <button
              type="submit"
              disabled={forgotLoading}
              className="w-full rounded-xl bg-white/15 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
            >
              {forgotLoading ? 'A enviar…' : 'Enviar link'}
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-white/50">ou continuar com</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Google */}
        <button
          onClick={signInWithGoogle}
          disabled={loading || (mode === 'signup' && !agree)}
          className={clsx(
            'flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10',
            (loading || (mode === 'signup' && !agree)) && 'opacity-60 cursor-not-allowed',
          )}
        >
          <GoogleIcon />
          Entrar com Google
        </button>

        {/* Rodapé */}
        <div className="mt-6 flex flex-col items-center gap-1 pb-2">
          <span className="text-[11px] italic text-white/60">Powered by</span>
          <img
            src="https://www.betano.pt/assets/images/header-logos/logo__betano.svg"
            className="h-7 opacity-95"
          />
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4-5.4 4-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .7 3.7 1.3l2.5-2.5C16.8 3.6 14.6 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12s4.2 9.3 9.3 9.3c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.1-1.6H12z"
      />
    </svg>
  );
}
