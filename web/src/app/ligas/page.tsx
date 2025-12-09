'use client';

import { useEffect, useState } from 'react';
import { supabasePKCE } from '@/utils/supabase/client';
import AdminGate from '../admin/_components/AdminGate';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();

type LeagueRow = {
  id: string;
  name: string;
  code: string;
  visibility: 'public' | 'private' | string;
  owner_id: string;
  role: 'owner' | 'member' | string;
};

function apiUrl(path: string) {
  const base = API_BASE ? API_BASE.replace(/\/+$/, '') : '';
  return base ? `${base}${path}` : path;
}

function LeaguesInner() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newVisibility, setNewVisibility] = useState<'public' | 'private'>(
    'private',
  );

  const [joinCode, setJoinCode] = useState('');
  const [busyCreate, setBusyCreate] = useState(false);
  const [busyJoin, setBusyJoin] = useState(false);

  // carregar utilizador
  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabasePKCE.auth.getUser();
        if (user) {
          setUserId(user.id);
        } else {
          setUserId(null);
        }
      } finally {
        setLoadingUser(false);
      }
    })();
  }, []);

  async function loadLeagues(currentUserId: string) {
    setLoadingLeagues(true);
    setErr(null);
    try {
      const res = await fetch(
        apiUrl(`/api/leagues?userId=${encodeURIComponent(currentUserId)}`),
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(
          `Falha a carregar ligas (${res.status}) ${res.statusText} ${txt}`,
        );
      }
      const json = (await res.json()) as LeagueRow[];
      setLeagues(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setErr(e?.message ?? 'Erro a carregar ligas');
    } finally {
      setLoadingLeagues(false);
    }
  }

  useEffect(() => {
    if (userId) {
      void loadLeagues(userId);
    }
  }, [userId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const name = newName.trim();
    if (!name) return;

    setBusyCreate(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl('/api/leagues'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId,
          name,
          visibility: newVisibility,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(
          `Falha a criar liga (${res.status}) ${res.statusText} ${txt}`,
        );
      }
      setNewName('');
      await loadLeagues(userId);
    } catch (e: any) {
      setErr(e?.message ?? 'Erro a criar liga');
    } finally {
      setBusyCreate(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const code = joinCode.trim();
    if (!code) return;

    setBusyJoin(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl('/api/leagues/join'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, code }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(
          `Falha a entrar na liga (${res.status}) ${res.statusText} ${txt}`,
        );
      }
      setJoinCode('');
      await loadLeagues(userId);
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao entrar na liga');
    } finally {
      setBusyJoin(false);
    }
  }

  if (loadingUser) {
    return <div className="py-6 opacity-80">A identificar utilizador…</div>;
  }

  if (!userId) {
    return (
      <div className="py-6 opacity-80">
        Faz login para poderes criar e gerir ligas.
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      <h1 className="text-3xl font-bold text-gradient mb-2">Ligas (beta)</h1>
      <p className="text-sm opacity-80">
        Aqui vais poder criar ligas privadas com amigos e ver um ranking só da
        tua liga. Por agora esta área está em testes e apenas disponível para
        admin.
      </p>

      {err && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm">
          {err}
        </div>
      )}

      {/* Criar liga */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h2 className="text-lg font-semibold">Criar nova liga</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da liga (ex: Amigos do Dragão)"
              className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm"
            />
            <select
              value={newVisibility}
              onChange={(e) =>
                setNewVisibility(
                  e.target.value === 'public' ? 'public' : 'private',
                )
              }
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm"
            >
              <option value="private">Privada</option>
              <option value="public">Pública (beta)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={!newName.trim() || busyCreate}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-50"
          >
            {busyCreate ? 'A criar…' : 'Criar liga'}
          </button>
        </form>
      </section>

      {/* Entrar por código */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h2 className="text-lg font-semibold">Entrar numa liga</h2>
        <form onSubmit={handleJoin} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Código da liga (ex: ABC123)"
            className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm tracking-[0.25em] uppercase"
          />
          <button
            type="submit"
            disabled={!joinCode.trim() || busyJoin}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-50"
          >
            {busyJoin ? 'A entrar…' : 'Entrar'}
          </button>
        </form>
      </section>

      {/* Lista de ligas */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">As tuas ligas</h2>
        {loadingLeagues ? (
          <div className="opacity-80 text-sm">A carregar ligas…</div>
        ) : leagues.length === 0 ? (
          <div className="opacity-70 text-sm">
            Ainda não estás em nenhuma liga.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {leagues.map((lg) => (
              <div
                key={lg.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{lg.name}</div>
                  <span className="text-[11px] uppercase opacity-70">
                    {lg.role === 'owner' ? 'Owner' : 'Membro'}
                  </span>
                </div>
                <div className="mt-1 text-[12px] opacity-80">
                  Código:{' '}
                  <span className="font-mono tracking-[0.2em] uppercase">
                    {lg.code}
                  </span>
                </div>
                <div className="mt-1 text-[12px] opacity-70">
                  Visibilidade:{' '}
                  {lg.visibility === 'public' ? 'Pública' : 'Privada'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function LeaguesPage() {
  return (
    <AdminGate>
      <LeaguesInner />
    </AdminGate>
  );
}
