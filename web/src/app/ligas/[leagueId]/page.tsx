'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabasePKCE } from '@/utils/supabase/client';
import AdminGate from '../../admin/_components/AdminGate';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();

function apiUrl(path: string) {
  const base = API_BASE ? API_BASE.replace(/\/+$/, '') : '';
  return base ? `${base}${path}` : path;
}

type League = {
  id: string;
  name: string;
  code: string;
  visibility: 'public' | 'private' | string;
  owner_id: string;
};

type MemberRow = {
  user_id: string;
  name: string | null;
  role: 'owner' | 'member' | string;
};

type LeagueDetailResponse = {
  league: League;
  members: MemberRow[];
  currentUserRole: 'owner' | 'member' | null;
};

type RankingRow = {
  user_id: string;
  name: string | null;
  total_points: number | null;
};

function LeagueRankingInner({ leagueId }: { leagueId: string }) {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [detail, setDetail] = useState<LeagueDetailResponse | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);

  // 1) obter utilizador
  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabasePKCE.auth.getUser();
        setUserId(user?.id ?? null);
      } finally {
        setLoadingUser(false);
      }
    })();
  }, []);

  // 2) carregar detalhe da liga
  async function loadDetail(currentUserId: string) {
    setLoadingDetail(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/leagues/${leagueId}?userId=${encodeURIComponent(currentUserId)}`),
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Falha a carregar liga (${res.status}) ${txt}`);
      }
      const json = (await res.json()) as LeagueDetailResponse;
      setDetail(json);
      setNameDraft(json.league.name);
    } catch (e: any) {
      setError(e?.message ?? 'Erro a carregar liga');
    } finally {
      setLoadingDetail(false);
    }
  }

  // 3) carregar ranking da liga
  async function loadRanking() {
    setLoadingRanking(true);
    try {
      const res = await fetch(apiUrl(`/api/leagues/${leagueId}/ranking`), {
        cache: 'no-store',
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Falha a carregar ranking (${res.status}) ${txt}`);
      }
      const json = await res.json();
      const list = Array.isArray(json.ranking) ? json.ranking : [];
      setRanking(list);
    } catch (e: any) {
      setError(e?.message ?? 'Erro a carregar ranking');
    } finally {
      setLoadingRanking(false);
    }
  }

  // 4) disparar carregamentos
  useEffect(() => {
    if (!userId) return;
    void loadDetail(userId);
    void loadRanking();
  }, [userId, leagueId]);

  const isOwner =
    !!detail && !!userId && detail.league.owner_id === userId;

  async function handleSaveName() {
    if (!userId || !detail) return;
    const newName = nameDraft.trim();
    if (!newName || newName === detail.league.name) return;

    setSavingName(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/leagues/${leagueId}`), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, name: newName }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Falha a atualizar nome (${res.status}) ${txt}`);
      }
      await loadDetail(userId);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao guardar alterações');
    } finally {
      setSavingName(false);
    }
  }

  async function handleDeleteLeague() {
    if (!userId || !detail) return;
    const confirm = window.prompt(
      `Para apagar a liga "${detail.league.name}", escreve: APAGAR`,
    );
    if (confirm !== 'APAGAR') return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/leagues/${leagueId}`), {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Falha a apagar liga (${res.status}) ${txt}`);
      }
      router.push('/ligas');
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao apagar liga');
    } finally {
      setDeleting(false);
    }
  }

  async function handleKickMember(memberId: string) {
    if (!userId || !detail) return;
    if (memberId === detail.league.owner_id) {
      alert('Não podes remover o owner da liga.');
      return;
    }
    setKickingUserId(memberId);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/leagues/${leagueId}/members/${memberId}`),
        {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId }),
        },
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Falha a remover membro (${res.status}) ${txt}`);
      }
      await loadDetail(userId);
      await loadRanking();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao remover membro');
    } finally {
      setKickingUserId(null);
    }
  }

  if (loadingUser || loadingDetail) {
    return <div className="py-6 opacity-80">A carregar liga…</div>;
  }

  if (!detail) {
    return (
      <div className="py-6 space-y-3">
        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm">
            {error}
          </div>
        )}
        <p className="opacity-80">Liga não encontrada.</p>
        <Link
          href="/ligas"
          className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
        >
          ← Voltar às ligas
        </Link>
      </div>
    );
  }

  const { league, members, currentUserRole } = detail;

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold mb-1">Liga: {league.name}</h1>
          <p className="text-sm opacity-70">
            Código:{' '}
            <span className="font-mono tracking-[0.2em] uppercase">
              {league.code}
            </span>{' '}
            • Visibilidade:{' '}
            {league.visibility === 'public' ? 'Pública' : 'Privada'} • Tu és:{' '}
            {currentUserRole ?? '—'}
          </p>
        </div>
        <Link
          href="/ligas"
          className="rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/15"
        >
          ← Voltar
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Gestão de liga (apenas owner) */}
      {isOwner && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h2 className="text-lg font-semibold">Gerir liga</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <label className="block text-xs uppercase opacity-60 mb-1">
                Nome da liga
              </label>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSaveName()}
              disabled={savingName || !nameDraft.trim()}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-50"
            >
              {savingName ? 'A guardar…' : 'Guardar alterações'}
            </button>
          </div>

          <div className="pt-3 border-t border-white/10 mt-3">
            <button
              type="button"
              onClick={() => void handleDeleteLeague()}
              disabled={deleting}
              className="rounded-full bg-red-500/80 px-4 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-60"
            >
              {deleting ? 'A apagar…' : 'Apagar liga'}
            </button>
          </div>
        </section>
      )}

      {/* Ranking da liga */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Ranking da liga</h2>
          {loadingRanking && (
            <span className="text-xs text-white/60">A carregar…</span>
          )}
        </div>
        {ranking.length === 0 && !loadingRanking ? (
          <p className="text-sm opacity-70">
            Ainda não há pontos nesta liga.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-black/30">
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
                {ranking.map((row, idx) => (
                  <tr
                    key={row.user_id}
                    className={idx % 2 === 0 ? 'bg-black/20' : 'bg-black/10'}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{idx + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.name ?? 'Sem nome'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      {row.total_points ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Membros da liga */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Membros da liga</h2>
          <span className="text-xs opacity-70">
            Total: {members.length}
          </span>
        </div>
        {members.length === 0 ? (
          <p className="text-sm opacity-70">Ainda não há membros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-black/30">
                <tr>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/60">
                    Jogador
                  </th>
                  <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/60">
                    Role
                  </th>
                  <th className="px-3 py-2 text-right text-xs uppercase tracking-wide text-white/60">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id} className="border-b border-white/5">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {m.name ?? 'Sem nome'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {m.role === 'owner' ? 'Owner' : 'Membro'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      {isOwner && m.user_id !== league.owner_id ? (
                        <button
                          type="button"
                          onClick={() => void handleKickMember(m.user_id)}
                          disabled={kickingUserId === m.user_id}
                          className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/15 disabled:opacity-50"
                        >
                          {kickingUserId === m.user_id
                            ? 'A remover…'
                            : 'Remover'}
                        </button>
                      ) : (
                        <span className="text-[11px] opacity-50">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function LeagueRankingPage({
  params,
}: {
  params: { leagueId: string };
}) {
  return (
    <AdminGate>
      <LeagueRankingInner leagueId={params.leagueId} />
    </AdminGate>
  );
}
