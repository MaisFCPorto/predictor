'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabasePKCE } from '@/utils/supabase/client';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hasExplicitAvatarField, setHasExplicitAvatarField] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabasePKCE.auth.getUser();
        if (cancelled) return;
        if (!data.user) {
          setUser(null);
          return;
        }
        setUser(data.user);
        setName(
          (data.user.user_metadata?.name as string | undefined) ??
            data.user.email?.split('@')[0] ??
            '',
        );

        const metadata = data.user.user_metadata ?? {};
        const hasAvatarField = Object.prototype.hasOwnProperty.call(
          metadata,
          'avatar_url',
        );
        setHasExplicitAvatarField(hasAvatarField);
        if (hasAvatarField) {
          setAvatarUrl(metadata.avatar_url ?? null);
        } else {
          setAvatarUrl(metadata.picture ?? null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('O nome visível não pode ficar vazio.');
      return;
    }
    if (!user) {
      setError('Sessão inválida. Volta a fazer login.');
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabasePKCE.auth.updateUser({
        data: { name: trimmedName },
      });
      if (updateError) {
        throw updateError;
      }

      const res = await fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          email: user.email ?? null,
          name: trimmedName,
          avatar_url: avatarUrl,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Falha ao sincronizar o perfil.');
      }

      setSuccess('Nome atualizado com sucesso. A página vai recarregar.');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível atualizar o perfil.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm opacity-80">
          A carregar perfil…
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-shell">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm">
          <p>Precisas de iniciar sessão para editar o nome visível.</p>
          <button
            type="button"
            onClick={() => router.push('/auth')}
            className="mt-4 rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Ir para login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="space-y-5 rounded-2xl border border-white/10 bg-black/40 p-6">
        <div>
          <p className="eyebrow">Perfil</p>
          <h1 className="text-3xl font-semibold">Editar nome visível</h1>
          <p className="mt-2 text-sm text-white/70">
            Este nome será usado no cabeçalho e no avatar do utilizador.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <label className="block text-sm font-medium text-white/80">
            Nome visível
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-black/80 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30"
          />

          {error && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {success}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-white/10 px-5 py-3 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
            >
              {saving ? 'A guardar…' : 'Guardar nome'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/jogos')}
              className="rounded-full border border-white/10 bg-black/20 px-5 py-3 text-sm hover:border-white/30"
            >
              Voltar a jogos
            </button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={saving || avatarUrl === null && !hasExplicitAvatarField}
              onClick={async () => {
                setError(null);
                setSuccess(null);
                setSaving(true);
                try {
                  const { error: updateError } = await supabasePKCE.auth.updateUser({
                    data: { avatar_url: null },
                  });
                  if (updateError) throw updateError;

                  const res = await fetch('/api/users/sync', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      id: user.id,
                      email: user.email ?? null,
                      name: name.trim() || null,
                      avatar_url: null,
                    }),
                  });
                  if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    throw new Error(text || 'Falha ao remover a imagem.');
                  }

                  setAvatarUrl(null);
                  setHasExplicitAvatarField(true);
                  setSuccess('Imagem removida. Recarregue a página se necessário.');
                } catch (e: any) {
                  setError(e?.message ?? 'Não foi possível remover a imagem.');
                } finally {
                  setSaving(false);
                }
              }}
              className="rounded-full border border-white/10 bg-black/20 px-5 py-3 text-sm hover:border-white/30 disabled:opacity-50"
            >
              Remover imagem
            </button>
            <button
              type="button"
              disabled
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/50"
            >
              Carregar imagem (em breve)
            </button>
          </div>
          </div>
        </form>
      </section>
    </main>
  );
}
