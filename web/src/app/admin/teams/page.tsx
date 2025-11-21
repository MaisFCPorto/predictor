'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import AdminGate from '../_components/AdminGate';

const API = process.env.NEXT_PUBLIC_API_BASE!;

type Team = {
  id: string;
  name: string;
  short_name?: string | null;
  crest_url?: string | null;
};

type EditableTeam = Team & {
  _name: string;
  _short: string;
  _crest: string;
  saving?: boolean;
};

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<EditableTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Form criação
  const [newTeam, setNewTeam] = useState<{
    id: string;
    name: string;
    short_name: string;
    crest_url: string;
    creating?: boolean;
  }>({
    id: '',
    name: '',
    short_name: '',
    crest_url: '',
  });

  const notify = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 1800);
  };

  async function loadTeams() {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await axios.get<Team[]>(`${API}/api/admin/teams`, {
        headers: { 'cache-control': 'no-store' },
      });

      const list: EditableTeam[] = (Array.isArray(data) ? data : []).map((t) => ({
        ...t,
        _name: t.name ?? '',
        _short: t.short_name ?? '',
        _crest: t.crest_url ?? '',
      }));

      setTeams(list);
    } catch (e: any) {
      setErr(e?.message ?? 'Falha a carregar equipas');
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTeams();
  }, []);

  async function createTeam() {
    try {
      if (!newTeam.id.trim() || !newTeam.name.trim()) {
        alert('ID e Nome são obrigatórios.');
        return;
      }
      setNewTeam((v) => ({ ...v, creating: true }));
      await axios.post(
        `${API}/api/admin/teams`,
        {
          id: newTeam.id.trim(),
          name: newTeam.name.trim(),
          short_name: newTeam.short_name.trim() || null,
          crest_url: newTeam.crest_url.trim() || null,
        },
        { headers: { 'cache-control': 'no-store' } },
      );
      notify('Equipa criada ✅');
      setNewTeam({ id: '', name: '', short_name: '', crest_url: '' });
      await loadTeams();
    } catch (e: any) {
      alert(e?.response?.data?.error ?? e?.message ?? 'Erro a criar equipa');
    } finally {
      setNewTeam((v) => ({ ...v, creating: false }));
    }
  }

  async function saveTeam(t: EditableTeam) {
    try {
      setTeams((list) =>
        list.map((x) => (x.id === t.id ? { ...x, saving: true } : x)),
      );
      await axios.patch(
        `${API}/api/admin/teams/${t.id}`,
        {
          name: t._name.trim() || t.name,
          short_name: t._short.trim() || null,
          crest_url: t._crest.trim() || null,
        },
        { headers: { 'cache-control': 'no-store' } },
      );
      notify('Equipa atualizada ✅');
      await loadTeams();
    } catch (e: any) {
      alert(e?.response?.data?.error ?? e?.message ?? 'Erro a atualizar equipa');
      setTeams((list) =>
        list.map((x) => (x.id === t.id ? { ...x, saving: false } : x)),
      );
    }
  }

  async function deleteTeam(id: string) {
    const ok = prompt(
      'Para confirmar a eliminação da equipa e fixtures relacionadas, escreve: APAGAR',
    );
    if (ok !== 'APAGAR') return;

    try {
      await axios.delete(`${API}/api/admin/teams/${id}`, {
        headers: { 'cache-control': 'no-store' },
      });
      notify('Equipa apagada ✅');
      await loadTeams();
    } catch (e: any) {
      alert(e?.response?.data?.error ?? e?.message ?? 'Erro ao apagar equipa');
    }
  }

  return (
    <AdminGate>
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <title>+Predictor — Admin Equipas</title>
        <h1 className="text-2xl font-semibold">Backoffice — Equipas</h1>

        {/* Card criação */}
        <section className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">Criar nova equipa</h2>
            <span className="text-xs text-white/70">
              ID e Nome são obrigatórios. ID deve ser curto (ex: FCP, MCI…)
            </span>
          </header>

          <div className="grid gap-3 md:grid-cols-[minmax(0,0.5fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,0.7fr)]">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide opacity-70">
                ID *
              </label>
              <input
                className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-sm uppercase"
                placeholder="ex: FCP"
                value={newTeam.id}
                onChange={(e) =>
                  setNewTeam((v) => ({ ...v, id: e.target.value.toUpperCase() }))
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide opacity-70">
                Nome *
              </label>
              <input
                className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
                placeholder="FC Porto"
                value={newTeam.name}
                onChange={(e) =>
                  setNewTeam((v) => ({ ...v, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide opacity-70">
                Nome curto
              </label>
              <input
                className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
                placeholder="Porto"
                value={newTeam.short_name}
                onChange={(e) =>
                  setNewTeam((v) => ({ ...v, short_name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide opacity-70">
                Crest URL
              </label>
              <input
                className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
                placeholder="https://…"
                value={newTeam.crest_url}
                onChange={(e) =>
                  setNewTeam((v) => ({ ...v, crest_url: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-col items-end justify-between gap-2">
              {/* preview crest criação */}
              <div className="flex w-full items-center justify-end gap-2">
                {newTeam.crest_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={newTeam.crest_url}
                    alt="preview crest"
                    className="h-10 w-10 rounded-full border border-white/20 bg-white object-contain"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/20 text-xs text-white/40">
                    ?
                  </div>
                )}
              </div>
              <button
                onClick={() => void createTeam()}
                disabled={newTeam.creating}
                className="inline-flex items-center justify-center rounded-full bg-emerald-500/85 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {newTeam.creating ? 'A criar…' : 'Criar equipa'}
              </button>
            </div>
          </div>
        </section>

        {/* Lista de equipas */}
        <section className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
          <header className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-medium">Equipas existentes</h2>
            <span className="text-xs text-white/60">Total: {teams.length}</span>
          </header>

          {err && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {err}
            </div>
          )}

          {loading ? (
            <div className="px-2 py-4 text-sm text-white/70">A carregar…</div>
          ) : teams.length === 0 ? (
            <div className="px-2 py-6 text-sm text-white/60">
              Ainda não existem equipas.
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((t) => {
                const valueName = t._name;
                const valueShort = t._short !== undefined ? t._short : t.short_name ?? '';
                const valueCrest = t._crest !== undefined ? t._crest : t.crest_url ?? '';

                return (
                  <div
                    key={t.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/12 bg-black/35 p-3 md:flex-row md:items-center"
                  >
                    {/* Esquerda: crest + nome */}
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white/5">
                        {valueCrest ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={valueCrest}
                            alt={valueName || t.name}
                            className="h-full w-full bg-white object-contain"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-white/70">
                            {valueShort?.slice(0, 3).toUpperCase() ||
                              t.id.slice(0, 3).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="max-w-[22ch] truncate font-medium">
                            {valueName || t.name}
                          </span>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white/80">
                            {t.id}
                          </span>
                        </div>
                        {valueShort ? (
                          <div className="text-xs text-white/60">
                            Nome curto: {valueShort}
                          </div>
                        ) : (
                          <div className="text-xs text-white/40">
                            Sem nome curto definido
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Direita: edição rápida */}
                    <div className="grid flex-1 gap-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,1.5fr)_auto]">
                      <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wide opacity-60">
                          Nome
                        </label>
                        <input
                          className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-xs"
                          value={valueName}
                          onChange={(e) =>
                            setTeams((list) =>
                              list.map((x) =>
                                x.id === t.id ? { ...x, _name: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wide opacity-60">
                          Nome curto
                        </label>
                        <input
                          className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-xs"
                          value={valueShort}
                          onChange={(e) =>
                            setTeams((list) =>
                              list.map((x) =>
                                x.id === t.id ? { ...x, _short: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] uppercase tracking-wide opacity-60">
                          Crest URL
                        </label>
                        <input
                          className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-xs"
                          value={valueCrest}
                          onChange={(e) =>
                            setTeams((list) =>
                              list.map((x) =>
                                x.id === t.id ? { ...x, _crest: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </div>

                      <div className="flex items-end justify-end gap-2">
                        <button
                          type="button"
                          title="Apagar equipa"
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-red-400/60 bg-red-500/10 text-xs text-red-200 hover:bg-red-500/20"
                          onClick={() => deleteTeam(t.id)}
                        >
                          🗑
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-emerald-500/85 px-3 py-1.5 text-[11px] font-medium text-white shadow-md hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={t.saving}
                          onClick={() => void saveTeam({ ...t, _name: valueName, _short: valueShort, _crest: valueCrest })}
                        >
                          {t.saving ? 'A guardar…' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Toast simples */}
        {msg && (
          <div className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-sm text-white shadow-lg shadow-black/60">
            {msg}
          </div>
        )}
      </main>
    </AdminGate>
  );
}
