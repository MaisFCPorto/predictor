'use client';

import { useEffect, useState } from 'react';
import { supabasePKCE } from '@/utils/supabase/client';
import AdminGate from '../admin/_components/AdminGate';
import Link from 'next/link';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();

type LeagueRow = {
  id: string;
  name: string;
  code: string;
  visibility: 'public' | 'private' | string;
  owner_id: string;
  role: 'owner' | 'member' | string;
};

type PublicLeagueRow = {
  id: string;
  name: string;
  code: string;
  visibility: 'public' | 'private' | string;
  owner_id: string;
  is_member: boolean;
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

  const [publicLeagues, setPublicLeagues] = useState<PublicLeagueRow[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(false);

  const [err, setErr] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newVisibility, setNewVisibility] = useState<'public' | 'private'>(
    'private',
  );

  const [joinCode, setJoinCode] = useState('');
  const [busyCreate, setBusyCreate] = useState(false);
  const [busyJoin, setBusyJoin] = useState(false);
  const [busyJoinPublicId, setBusyJoinPublicId] = useState<string | null>(null);

  const [joinMessage, setJoinMessage] = useState<string | null>(null);

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
      setLeagues([]);
    } finally {
      setLoadingLeagues(false);
    }
  }

  async function loadPublicLeagues(currentUserId: string) {
    setLoadingPublic(true);
    try {
      const res = await fetch(
        apiUrl(`/api/leagues/public?userId=${encodeURIComponent(currentUserId)}`),
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(
          `Falha a carregar ligas públicas (${res.status}) ${res.statusText} ${txt}`,
        );
      }
      const json = (await res.json()) as PublicLeagueRow[];
      setPublicLeagues(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setErr((prev) => prev ?? e?.message ?? 'Erro a carregar ligas públicas');
      setPublicLeagues([]);
    } finally {
      setLoadingPublic(false);
    }
  }

  useEffect(() => {
    if (userId) {
      void loadLeagues(userId);
      void loadPublicLeagues(userId);
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
      await loadPublicLeagues(userId);
    } catch (e: any) {
      setErr(e?.message ?? 'Erro a criar liga');
    } finally {
      setBusyCreate(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      setErr('Não foi possível identificar o utilizador (userId em falta).');
      return;
    }

    const code = joinCode.trim();
    if (!code) return;

    setBusyJoin(true);
    setErr(null);
    setJoinMessage(null);
    try {
      const res = await fetch(
        apiUrl(
          `/api/leagues/join?userId=${encodeURIComponent(
            userId,
          )}&code=${encodeURIComponent(code)}`,
        ),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId, code }),
        },
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(
          `Falha a entrar na liga (${res.status}) ${txt || res.statusText}`,
        );
      }

      setJoinCode('');
      setJoinMessage('Entrei na liga com sucesso ✅');
      await loadLeagues(userId);
      await loadPublicLeagues(userId);
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao entrar na liga');
    } finally {
      setBusyJoin(false);
    }
  }

  async function handleJoinPublic(league: PublicLeagueRow) {
    if (!userId) return;
    if (league.is_member) return;

    setBusyJoinPublicId(league.id);
    setErr(null);

    try {
      const res = await fetch(
        apiUrl(
          `/api/leagues/join?userId=${encodeURIComponent(
            userId,
          )}&code=${encodeURIComponent(league.code)}`,
        ),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId, code: league.code }),
        },
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(
          `Falha a entrar na liga (${res.status}) ${txt || res.statusText}`,
        );
      }

      await loadLeagues(userId);
      await loadPublicLeagues(userId);
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao entrar na liga pública');
    } finally {
      setBusyJoinPublicId(null);
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
      <h1 className="mb-2 text-3xl font-bold text-gradient">Ligas (beta)</h1>
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
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
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
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold">Entrar numa liga</h2>
        <form onSubmit={handleJoin} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Código da liga (ex: ABC123)"
            className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm uppercase tracking-[0.25em]"
          />
          <button
            type="submit"
            disabled={!joinCode.trim() || busyJoin}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-50"
          >
            {busyJoin ? 'A entrar…' : 'Entrar'}
          </button>
        </form>
        {joinMessage && (
          <div className="text-xs text-emerald-200">{joinMessage}</div>
        )}
      </section>

      {/* As tuas ligas */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">As tuas ligas</h2>
        {loadingLeagues ? (
          <div className="text-sm opacity-80">A carregar ligas…</div>
        ) : leagues.length === 0 ? (
          <div className="text-sm opacity-70">
            Ainda não estás em nenhuma liga.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {leagues.map((lg) => (
              <Link
                key={lg.id}
                href={`/ligas/${lg.id}`}
                className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm transition-colors hover:border-white/30 hover:bg-white/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{lg.name}</div>
                    <div className="mt-1 text-[12px] opacity-80">
                      Código:{' '}
                      <span className="font-mono uppercase tracking-[0.2em]">
                        {lg.code}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] opacity-70">
                      Visibilidade:{' '}
                      {lg.visibility === 'public' ? 'Pública' : 'Privada'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px] uppercase">
                    <span className="rounded-full bg-white/10 px-2 py-0.5">
                      {lg.role === 'owner' ? 'Owner' : 'Membro'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Ligas públicas */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ligas públicas</h2>
        {loadingPublic ? (
          <div className="text-sm opacity-80">A carregar ligas públicas…</div>
        ) : publicLeagues.length === 0 ? (
          <div className="text-sm opacity-70">
            Ainda não há ligas públicas disponíveis.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {publicLeagues.map((lg) => {
              const isMember = lg.is_member;
              const busy = busyJoinPublicId === lg.id;

              return (
                <div
                  key={lg.id}
                  className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{lg.name}</div>
                      <div className="mt-1 text-[12px] opacity-80">
                        Código:{' '}
                        <span className="font-mono uppercase tracking-[0.2em]">
                          {lg.code}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-[11px] uppercase">
                      {isMember ? (
                        <Link
                          href={`/ligas/${lg.id}`}
                          className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/15"
                        >
                          Abrir
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleJoinPublic(lg)}
                          disabled={busy}
                          className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/15 disabled:opacity-50"
                        >
                          {busy ? 'A entrar…' : 'Entrar'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
