'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabasePKCE } from '@/utils/supabase/client';
import clsx from 'clsx';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = supabasePKCE;

  const [checking, setChecking] = useState(true);
  const [sessionOk, setSessionOk] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('getSession error', error);
        }
        if (!cancelled) {
          if (data?.session) {
            setSessionOk(true);
          } else {
            setErr(
              'Link de recuperação inválido ou expirado. Pede um novo link na página de login.'
            );
          }
        }
      } catch (e) {
        if (!cancelled) {
          setErr(
            'Não foi possível validar o link de recuperação. Tenta voltar a abrir o link ou pedir um novo.'
          );
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!sessionOk) {
      setErr('Sessão de recuperação inválida. Volta a pedir um novo link.');
      return;
    }

    if (!password || password.length < 6) {
      setErr('A nova password deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirm) {
      setErr('A confirmação não coincide com a nova password.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErr(error.message || 'Não foi possível atualizar a password.');
      } else {
        setOk('Password atualizada com sucesso! Já podes fazer login novamente.');
      }
    } catch (e: any) {
      setErr(e?.message || 'Erro ao atualizar a password.');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !loading && sessionOk && password.length >= 6 && password === confirm;

  return (
    <main className="mx-auto max-w-lg px-6 py-10 md:py-16">
      <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
        {/* Logo + título */}
        <div className="mb-6 text-center">
          <img
            src="/logobranco.png"
            alt="+Predictor"
            className="h-14 w-auto mx-auto mb-2"
          />
          <h1 className="text-lg font-semibold">Recuperar password</h1>
          <p className="mt-1 text-sm text-white/70">
            Define uma nova password para continuares a jogar.
          </p>
        </div>

        {/* Estado inicial: a validar link */}
        {checking && (
          <div className="text-sm text-white/70">
            A validar o link de recuperação…
          </div>
        )}

        {/* Erro de sessão / link inválido */}
        {!checking && !sessionOk && (
          <div className="space-y-4">
            {err && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {err}
              </div>
            )}
            <button
              type="button"
              onClick={() => router.push('/auth')}
              className="w-full rounded-xl bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/20"
            >
              Voltar ao login
            </button>
          </div>
        )}

        {/* Form de nova password */}
        {!checking && sessionOk && (
          <>
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

            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-white/70">
                  Nova password
                </label>
                <input
                  type="password"
                  value={password}
                  minLength={6}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-white/70">
                  Confirmar nova password
                </label>
                <input
                  type="password"
                  value={confirm}
                  minLength={6}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className={clsx(
                  'mt-2 w-full rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                  !canSubmit
                    ? 'cursor-not-allowed bg-white/10 text-white/60'
                    : 'bg-white/15 hover:bg-white/20',
                )}
              >
                {loading ? 'A atualizar…' : 'Atualizar password'}
              </button>
            </form>

            {/* Botão para login depois de sucesso */}
            {ok && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => router.push('/auth')}
                  className="w-full rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                >
                  Ir para a página de login
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
