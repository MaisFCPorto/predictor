'use client';

import { useEffect, useState } from 'react';
import AdminGate from '../_components/AdminGate';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();

type LeagueRow = {
  id: string;
  name: string;
  owner_user_id: string;
  join_code: string;
  visibility: string;
  start_mode: string;
  start_date: string | null;
  start_fixture_id: string | null;
  competition_code: string | null;
  created_at: string;
  member_count?: number;
};

export default function AdminLeaguesPage() {
  return (
    <AdminGate>
      <LeaguesInner />
    </AdminGate>
  );
}

function LeaguesInner() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [startMode, setStartMode] = useState<'from_start' | 'from_created'>('from_created');
  const [competitionCode, setCompetitionCode] = useState<string | ''>('');
  const [saving, setSaving] = useState(false);

  // TEMP: owner_user_id manual (depois podemos auto-preencher com o utilizador loggado)
  const [ownerUserId, setOwnerUserId] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const base = API_BASE ? API_BASE.replace(/\/+$/, '') : '';
      const url = base ? `${base}/api/admin/leagues` : '/api/admin/leagues';

      const res = await fetch(url, {
        headers: {
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      setRows(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setError(e?.message ?? 'Erro a carregar ligas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !ownerUserId.trim()) {
      setError('Nome e owner_user_id são obrigatórios (por agora).');
      return;
    }

    try {
      setSaving(true);

      const base = API_BASE ? API_BASE.replace(/\/+$/, '') : '';
      const url = base ? `${base}/api/admin/leagues` : '/api/admin/leagues';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-key': process.env.NEXT_PUBLIC_ADMIN_KEY || '',
        },
        body: JSON.stringify({
          name: name.trim(),
          owner_user_id: ownerUserId.trim(),
          start_mode: startMode,
          competition_code: competitionCode || null,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Erro a criar liga: ${txt.slice(0, 160)}`);
      }

      setName('');
      setCompetitionCode('');
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao criar liga');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="py-6 space-y-6">
      <h1 className="text-2xl font-bold mb-2">Ligas (beta – só admin)</h1>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h2 className="text-lg font-semibold">Criar nova liga</h2>
        <p className="text-sm text-white/70">
          Nesta fase é só para testes internos. Mais tarde vamos
          permitir aos utilizadores criarem ligas próprias pela UI.
        </p>

        <form onSubmit={onCreate} className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/60">Nome da liga</label>
            <input
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Amigos do Dragão"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/60">Owner user_id</label>
            <input
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm font-mono text-xs"
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              placeholder="id da tabela users / supabase"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/60">Início do ranking</label>
            <select
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm"
              value={startMode}
              onChange={(e) => setStartMode(e.target.value as any)}
            >
              <option value="from_start">Desde o primeiro jogo</option>
              <option value="from_created">Desde a criação da liga</option>
              {/* para já não expomos date/fixture, fica para uma fase seguinte */}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/60">Filtrar por competição (opcional)</label>
            <select
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm"
              value={competitionCode}
              onChange={(e) => setCompetitionCode(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="LP">Liga Portugal</option>
              <option value="LE">Liga Europa</option>
              <option value="TP">Taça de Portugal</option>
              <option value="TL">Taça da Liga</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-center justify-between">
            {error && (
              <div className="text-xs text-red-300">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="ml-auto rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-60"
            >
              {saving ? 'A criar…' : 'Criar liga'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Ligas existentes</h2>
          {loading && <span className="text-xs text-white/60">A carregar…</span>}
        </div>

        {rows.length === 0 && !loading && (
          <div className="text-sm text-white/70">Ainda não há ligas.</div>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-white/60">
                <tr>
                  <th className="px-2 py-1 text-left">Nome</th>
                  <th className="px-2 py-1 text-left">Owner</th>
                  <th className="px-2 py-1 text-left">Código</th>
                  <th className="px-2 py-1 text-left">Modo</th>
                  <th className="px-2 py-1 text-center">Membros</th>
                  <th className="px-2 py-1 text-left">Criada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td className="px-2 py-1">{l.name}</td>
                    <td className="px-2 py-1 font-mono text-[11px]">
                      {l.owner_user_id.slice(0, 6)}…{l.owner_user_id.slice(-4)}
                    </td>
                    <td className="px-2 py-1">
                      <code className="rounded bg-black/40 px-2 py-0.5 text-xs">
                        {l.join_code}
                      </code>
                    </td>
                    <td className="px-2 py-1 text-xs">
                      {l.start_mode}
                      {l.competition_code && ` · ${l.competition_code}`}
                    </td>
                    <td className="px-2 py-1 text-center">
                      {l.member_count ?? 0}
                    </td>
                    <td className="px-2 py-1 text-xs text-white/60">
                      {new Date(l.created_at).toLocaleString('pt-PT')}
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
