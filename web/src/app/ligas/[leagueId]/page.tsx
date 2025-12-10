'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabasePKCE } from '@/utils/supabase/client';
import AdminGate from '../../admin/_components/AdminGate';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();

type LeagueInfo = {
  id: string;
  name: string;
  code: string;
  visibility: 'public' | 'private' | string;
  owner_id: string;
};

type MemberRow = {
  user_id: string;
  role: 'owner' | 'member' | string;
  name: string | null;
};

type LeagueDetailResponse = {
  league: LeagueInfo;
  members: MemberRow[];
  currentUserRole: 'owner' | 'member' | null;
};

type RankingRow = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  total_points: number;
  position: number;
};

function apiUrl(path: string) {
  const base = API_BASE ? API_BASE.replace(/\/+$/, '') : '';
  return base ? `${base}${path}` : path;
}

function LeagueDetailInner() {
  const params = useParams() as { leagueId?: string };
  const router = useRouter();
  const leagueId = params?.leagueId ?? '';

  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [detail, setDetail] = useState<LeagueDetailResponse | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [editName, setEditName] = useState('');
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>(
    'private',
  );
  const [busySave, setBusySave] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyMember, setBusyMember] = useState<string | null>(null);

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

  async function loadAll(currentUserId: string, id: string) {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      // detalhe + membros
      const detailRes = await fetch(
        apiUrl(
          `/api/leagues/${encodeURIComponent(
            id,
          )}?userId=${encodeURIComponent(currentUserId)}`,
        ),
        { cache: 'no-store' },
      );
      if (!detailRes.ok) {
        const txt = await detailRes.text().catch(() => '');
        throw new Error(
          `Falha a carregar liga (${detailRes.status}) ${detailRes.statusText} ${txt}`,
        );
      }
      const detailJson = (await detailRes.json()) as LeagueDetailResponse;
      setDetail(detailJson);
      setEditName(detailJson.league.name);
      setEditVisibility(
        detailJson.league.visibility === 'public' ? 'public' : 'private',
      );

      // ranking
      const rankingRes = await fetch(
        apiUrl(`/api/leagues/${encodeURIComponent(id)}/ranking`),
        { cache: 'no-store' },
      );
      if (!rankingRes.ok) {
        const txt = await rankingRes.text().catch(() => '');
        throw new Error(
          `Falha a carregar ranking (${rankingRes.status}) ${rankingRes.statusText} ${txt}`,
        );
      }
      const rankingJson = (await rankingRes.json()) as {
        ranking: RankingRow[];
      };
      setRanking(Array.isArray(rankingJson.ranking) ? rankingJson.ranking : []);
    } catch (e: any) {
      setErr(e?.message ?? 'Erro a carregar detalhes da liga');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userId && leagueId) {
      void loadAll(userId, leagueId);
    }
  }, [userId, leagueId]);

  async function handleSave() {
    if (!userId || !detail) return;
    setBusySave(true);
    setErr(null);
    try {
      const res = await fetch(
        apiUrl(`/api/leagues/${encodeURIComponent(detail.league.id)}`),
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            userId,
            name: editName.trim(),
            visibility: editVisibility,
          }),
        },
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(
          `Falha a guardar liga (${res.status}) ${res.statusText} ${txt}`,
        );
      }
      await loadAll(userId, detail.league.id);
    } catch (e: any) {
      setErr(e?.message ?? 'Erro a guardar alterações');
    } finally {
      setBusySave(false);
    }
  }

  async function handleDelete() {
    if (!userId || !detail) return;
    const confirmText = prompt(
      `Para apagar a liga "${detail.league.name}" escreve: APAGAR`,
    );
    if (confirmText !== 'APAGAR') return;

    setBusyDelete(true);
    setErr(null);
    try {
      const res = await fetch(
        apiUrl(`/api/leagues/${encodeURIComponent(detail.league.id)}`),
        {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId }),
        },
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(
          `Falha a apagar liga (${res.status}) ${res.statusText} ${txt}`,
        );
      }
      router.push('/ligas');
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao apagar liga');
    } finally {
      setBusyDelete(false);
    }
  }

  async function handleRemoveMember(memberUserId: string) {
    if (!userId || !detail) return;
    setBusyMember(memberUserId);
    setErr(null);
    try {
      const res = await fetch(
        apiUrl(
          `/api/leagues/${encodeURIComponent(
            detail.league.id,
          )}/members/${encodeURIComponent(memberUserId)}`,
        ),
        {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId }),
        },
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(
          `Falha a remover membro (${res.status}) ${res.statusText} ${txt}`,
        );
      }
      await loadAll(userId, detail.league.id);
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao remover membro');
    } finally {
      setBusyMember(null);
    }
  }

  if (!leagueId) {
    return (
      <div className="py-6 opacity-80">
        ID de liga em falta na rota. Volta às{' '}
        <button
          type="button"
          className="underline"
          onClick={() => router.push('/ligas')}
        >
          ligas
        </button>
        .
      </div>
    );
  }

  if (loadingUser) {
    return <div className="py-6 opacity-80">A identificar utilizador…</div>;
  }

  if (!userId) {
    return (
      <div className="py-6 opacity-80">
        Faz login para veres o detalhe da liga.
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      <button
        type="button"
        onClick={() => router.push('/ligas')}
        className="text-xs rounded-full border border-white/20 px-3 py-1 hover:bg-white/10"
      >
        ← Voltar às ligas
      </button>

      {err && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm">
          {err}
        </div>
      )}

      {/* Cabeçalho liga + edição (owner) */}
      {detail ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">
                Liga: {detail.league.name}
              </h1>
              <p className="text-sm opacity-80">
                Código:{' '}
                <span className="font-mono tracking-[0.25em] uppercase">
                  {detail.league.code}
                </span>
              </p>
            </div>
            <div className="text-right text-xs opacity-80">
              <div>
                Visibilidade:{' '}
                {detail.league.visibility === 'public'
                  ? 'Pública'
                  : 'Privada'}
              </div>
              <div>
                O teu papel:{' '}
                {detail.currentUserRole === 'owner' ? 'Owner' : 'Membro'}
              </div>
            </div>
          </div>

          {detail.currentUserRole === 'owner' && (
            <>
              <hr className="border-white/10" />
              <div className="space-y-2">
                <h2 className="text-sm font-semibold">
                  Gestão da liga (apenas owner)
                </h2>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm"
                    placeholder="Nome da liga"
                  />
                  <select
                    value={editVisibility}
                    onChange={(e) =>
                      setEditVisibility(
                        e.target.value === 'public' ? 'public' : 'private',
                      )
                    }
                    className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm"
                  >
                    <option value="private">Privada</option>
                    <option value="public">Pública (beta)</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={busySave || !editName.trim()}
                    className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-50"
                  >
                    {busySave ? 'A guardar…' : 'Guardar alterações'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={busyDelete}
                    className="rounded-full bg-red-500/80 px-4 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-50"
                  >
                    {busyDelete ? 'A apagar…' : 'Apagar liga'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      ) : (
        <div className="opacity-80 text-sm">
          {loading ? 'A carregar liga…' : 'Liga não encontrada.'}
        </div>
      )}

      {/* Membros */}
      {detail && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h2 className="text-lg font-semibold">Membros da liga</h2>
          {detail.members.length === 0 ? (
            <div className="opacity-70 text-sm">Ainda não há membros.</div>
          ) : (
            <div className="space-y-1 text-sm">
              {detail.members.map((m) => {
                const isOwner = m.role === 'owner';
                const isSelf = m.user_id === userId;
                const canKick =
                  detail.currentUserRole === 'owner' && !isOwner && !isSelf;

                return (
                  <div
                    key={m.user_id}
                    className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2"
                  >
                    <div>
                      <div className="font-medium">
                        {m.name || 'Jogador sem nome'}
                      </div>
                      <div className="text-[11px] opacity-70">
                        {isOwner ? 'Owner' : 'Membro'}
                        {isSelf ? ' • Tu' : ''}
                      </div>
                    </div>
                    {canKick && (
                      <button
                        type="button"
                        onClick={() => void handleRemoveMember(m.user_id)}
                        disabled={busyMember === m.user_id}
                        className="rounded-full bg-red-500/80 px-3 py-1 text-xs hover:bg-red-500 disabled:opacity-50"
                      >
                        {busyMember === m.user_id ? 'A remover…' : 'Remover'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Ranking */}
      {detail && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h2 className="text-lg font-semibold">
            Ranking da liga &quot;{detail.league.name}&quot;
          </h2>
          {ranking.length === 0 ? (
            <div className="opacity-70 text-sm">
              Ainda não há pontos registados nesta liga.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-black/40">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/60">
                      Pos
                    </th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/60">
                      Jogador
                    </th>
                    <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-white/60">
                      Pontos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r) => (
                    <tr
                      key={r.user_id}
                      className="border-b border-white/5 last:border-b-0"
                    >
                      <td className="px-3 py-2 whitespace-nowrap font-mono">
                        {r.position}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.name}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-semibold">
                        {r.total_points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function LeagueDetailPage() {
  return (
    <AdminGate>
      <LeagueDetailInner />
    </AdminGate>
  );
}
