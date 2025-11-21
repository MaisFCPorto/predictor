'use client';

import { useEffect, useMemo, useState } from 'react';
import axios, { AxiosError } from 'axios';
import AdminGate from '../_components/AdminGate';

/* -------------------------------------------
   Axios admin (igual ao usado em admin/fixtures)
-------------------------------------------- */
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

const adm = axios.create({
  baseURL: '',
});

adm.interceptors.request.use((config) => {
  if (ADMIN_KEY) {
    config.headers = config.headers ?? {};
    (config.headers as any)['x-admin-key'] = ADMIN_KEY;
  }
  return config;
});

adm.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) alert('Sessão expirada ou em falta. Faz login novamente.');
    if (status === 403) alert('Acesso negado (precisas de ser admin).');
    return Promise.reject(error);
  },
);

type Team = {
  id: string;
  name: string;
  short_name?: string | null;
  crest_url?: string | null;
};

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<{ error?: string; message?: string }>;
    return e.response?.data?.error ?? e.response?.data?.message ?? e.message;
  }
  if (err instanceof Error) return err.message;
  return 'Ocorreu um erro';
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const [newTeam, setNewTeam] = useState<Team>({
    id: '',
    name: '',
    short_name: '',
    crest_url: '',
  });

  const notify = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 1500);
  };

  /* ----------------- Load ----------------- */
  async function loadTeams() {
    setLoading(true);
    try {
      const { data } = await adm.get<Team[]>('/api/admin/teams', {
        headers: { 'cache-control': 'no-store' },
      });
      setTeams(Array.isArray(data) ? data : []);
    } catch (e) {
      alert(errorMessage(e));
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTeams();
  }, []);

  /* ----------------- Create ----------------- */
  async function createTeam() {
    try {
      setCreating(true);
      if (!newTeam.id.trim() || !newTeam.name.trim()) {
        throw new Error('ID e Nome são obrigatórios.');
      }

      await adm.post('/api/admin/teams', {
        id: newTeam.id.trim(),
        name: newTeam.name.trim(),
        short_name: newTeam.short_name?.trim() || null,
        crest_url: newTeam.crest_url?.trim() || null,
      });

      setNewTeam({ id: '', name: '', short_name: '', crest_url: '' });
      notify('Equipa criada ✅');
      await loadTeams();
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  /* ----------------- Update ----------------- */
  async function updateTeam(partial: Partial<Team> & { id: string }) {
    try {
      await adm.patch(`/api/admin/teams/${partial.id}`, partial);
      notify('Equipa atualizada ✅');
      await loadTeams();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  /* ----------------- Delete ----------------- */
  async function deleteTeam(id: string, name: string) {
    const confirmText = prompt(
      `Para confirmar a eliminação da equipa "${name}" e de eventuais fixtures relacionadas, escreve: APAGAR`,
    );
    if (confirmText !== 'APAGAR') return;

    try {
      await adm.delete(`/api/admin/teams/${id}`);
      notify('Equipa apagada ✅');
      await loadTeams();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  /* ----------------- Filtro ----------------- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => {
      const id = t.id.toLowerCase();
      const name = t.name.toLowerCase();
      const short = (t.short_name ?? '').toLowerCase();
      return id.includes(q) || name.includes(q) || short.includes(q);
    });
  }, [teams, query]);

  const hasCreateErrors =
    !newTeam.id.trim() || !newTeam.name.trim();

  return (
    <AdminGate>
      <main className="max-w-5xl mx-auto p-6 space-y-4">
        <title>+Predictor — Admin Equipas</title>
        <h1 className="text-2xl font-semibold">Backoffice — Equipas</h1>

        {/* Card: criar nova equipa */}
        <section className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">Criar nova equipa</h2>
            {hasCreateErrors && (
              <span className="text-xs text-amber-300">
                ID e Nome são obrigatórios
              </span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,0.4fr)_minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,1.4fr)]">
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wide opacity-70">
                ID *
              </label>
              <input
                className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-sm uppercase"
                placeholder="ex: fcp, mci, avs"
                value={newTeam.id}
                onChange={(e) =>
                  setNewTeam((v) => ({ ...v, id: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wide opacity-70">
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
              <label className="text-[11px] uppercase tracking-wide opacity-70">
                Nome curto
              </label>
              <input
                className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
                placeholder="FCP"
                value={newTeam.short_name ?? ''}
                onChange={(e) =>
                  setNewTeam((v) => ({ ...v, short_name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-wide opacity-70">
                Crest URL
              </label>
              <input
                className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-sm"
                placeholder="https://…"
                value={newTeam.crest_url ?? ''}
                onChange={(e) =>
                  setNewTeam((v) => ({ ...v, crest_url: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => void createTeam()}
              disabled={creating || hasCreateErrors}
              className="inline-flex items-center justify-center rounded-full bg-emerald-500/85 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/40 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-500"
            >
              {creating ? 'A criar…' : 'Criar equipa'}
            </button>
          </div>
        </section>

        {/* Card: lista de equipas */}
        <section className="rounded-2xl border border-white/10 bg-black/25 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium">Lista de equipas</h2>
            <div className="flex-1" />
            <input
              className="rounded-md border border-white/15 bg-black/40 px-3 py-1.5 text-sm w-full max-w-xs"
              placeholder="Filtrar por id / nome…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="opacity-70 text-sm">A carregar equipas…</div>
          ) : filtered.length === 0 ? (
            <div className="opacity-70 text-sm">
              Sem equipas para mostrar.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-white/12 bg-black/30 px-3 py-3"
                >
                  {/* Crest + ID */}
                  <div className="flex items-center gap-3 min-w-[160px]">
                    <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                      {t.crest_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.crest_url}
                          alt={t.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs uppercase opacity-70">
                          {t.short_name || t.id}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs uppercase opacity-60">
                        ID: <span className="font-mono">{t.id}</span>
                      </div>
                      <input
                        className="rounded-md border border-white/15 bg-black/40 px-2 py-1 text-sm min-w-[180px]"
                        defaultValue={t.name}
                        onBlur={(e) =>
                          updateTeam({
                            id: t.id,
                            name: e.target.value || t.name,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Nome curto */}
                  <div className="flex-1 min-w-[120px] max-w-[140px]">
                    <label className="text-[11px] uppercase tracking-wide opacity-60">
                      Nome curto
                    </label>
                    <input
                      className="w-full rounded-md border border-white/15 bg-black/40 px-2 py-1 text-sm"
                      defaultValue={t.short_name ?? ''}
                      onBlur={(e) =>
                        updateTeam({
                          id: t.id,
                          short_name: e.target.value || null,
                        })
                      }
                    />
                  </div>

                  {/* Crest URL */}
                  <div className="flex-1 min-w-[220px]">
                    <label className="text-[11px] uppercase tracking-wide opacity-60">
                      Crest URL
                    </label>
                    <input
                      className="w-full rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs"
                      defaultValue={t.crest_url ?? ''}
                      onBlur={(e) =>
                        updateTeam({
                          id: t.id,
                          crest_url: e.target.value || null,
                        })
                      }
                    />
                  </div>

                  {/* Ações */}
                  <div className="ml-auto flex items-end">
                    <button
                      type="button"
                      className="rounded-full px-3 py-1 text-xs text-red-300 hover:bg-red-500/10"
                      onClick={() => void deleteTeam(t.id, t.name)}
                    >
                      Apagar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Toast simples */}
        {msg && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-sm shadow-lg">
            {msg}
          </div>
        )}
      </main>
    </AdminGate>
  );
}
