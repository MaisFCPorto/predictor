'use client';

import { useEffect, useMemo, useState } from 'react';
import axios, { AxiosError } from 'axios';
import AdminGate from '../_components/AdminGate';

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
  }
);

/* -------------------- Tipos -------------------- */

type FixtureOption = {
  id: string;
  label: string;
};

type PredictionRow = {
  id: string;
  user_name: string;
  pred_home: number | null;
  pred_away: number | null;
  pred_scorer_name: string | null;
  created_at: string;
};

/* -------------------- Utils -------------------- */

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<{ error?: string; message?: string }>;
    return e.response?.data?.error ?? e.response?.data?.message ?? e.message;
  }
  if (err instanceof Error) return err.message;
  return 'Ocorreu um erro';
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* =============================================================== */

function AdminPredictionsInner() {
  const [fixtures, setFixtures] = useState<FixtureOption[]>([]);
  const [selectedFixtureId, setSelectedFixtureId] = useState('');
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const notify = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 1500);
  };

  /* -------------------- Loaders -------------------- */

  async function loadFixtures() {
    try {
      setLoadingFixtures(true);
      setError(null);
      const { data } = await adm.get<{ fixtures: FixtureOption[] }>(
        '/api/admin/predictions/fixtures',
        { headers: { 'cache-control': 'no-store' } },
      );
      const list = Array.isArray(data?.fixtures) ? data.fixtures : [];
      setFixtures(list);
      if (list.length > 0 && !selectedFixtureId) {
        setSelectedFixtureId(list[0].id);
      }
    } catch (e) {
      setError(errorMessage(e));
      setFixtures([]);
    } finally {
      setLoadingFixtures(false);
    }
  }

  async function loadPredictions(fixtureId: string) {
    if (!fixtureId) {
      setPredictions([]);
      return;
    }
    try {
      setLoadingPredictions(true);
      setError(null);
      const { data } = await adm.get<{ predictions: PredictionRow[] }>(
        `/api/admin/predictions/fixture/${fixtureId}`,
        { headers: { 'cache-control': 'no-store' } },
      );
      const list = Array.isArray(data?.predictions) ? data.predictions : [];
      setPredictions(list);
    } catch (e) {
      setError(errorMessage(e));
      setPredictions([]);
    } finally {
      setLoadingPredictions(false);
    }
  }

  useEffect(() => {
    void loadFixtures();
  }, []);

  useEffect(() => {
    if (!selectedFixtureId) {
      setPredictions([]);
      return;
    }
    void loadPredictions(selectedFixtureId);
  }, [selectedFixtureId]);

  /* -------------------- Derivados -------------------- */

  const selectedFixture = useMemo(
    () => fixtures.find((f) => f.id === selectedFixtureId) ?? null,
    [fixtures, selectedFixtureId],
  );

  const totalUsers = useMemo(
    () => new Set(predictions.map((p) => p.user_name)).size,
    [predictions],
  );

  /* -------------------- Render -------------------- */

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-4">
      <title>+Predictor - Admin Predictions</title>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Backoffice — Predictions</h1>
          <p className="text-sm text-white/60">
            Consulta todas as previsões (resultado + marcador) submetidas para um jogo.
          </p>
        </div>

        {/* Selector de jogo, no mesmo estilo dos filtros de fixtures */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/70">Jogo:</span>
          <select
            className="rounded border border-white/10 bg-black/20 px-3 py-2 text-sm min-w-[260px]"
            value={selectedFixtureId}
            onChange={(e) => setSelectedFixtureId(e.target.value)}
            disabled={loadingFixtures || fixtures.length === 0}
          >
            {loadingFixtures && <option value="">A carregar jogos…</option>}
            {!loadingFixtures && fixtures.length === 0 && (
              <option value="">Sem jogos disponíveis</option>
            )}
            {!loadingFixtures &&
              fixtures.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Mensagem de erro */}
      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Erro: {error}
        </div>
      )}

      {/* Card com resumo, no estilo dos cards de fixtures */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-1">
          <div className="text-xs uppercase tracking-wide text-white/50">
            Jogo selecionado
          </div>
          <div className="text-sm font-medium">
            {selectedFixture ? selectedFixture.label : 'Nenhum'}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-1">
          <div className="text-xs uppercase tracking-wide text-white/50">
            Total de predictions
          </div>
          <div className="text-xl font-semibold">{predictions.length}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-1">
          <div className="text-xs uppercase tracking-wide text-white/50">
            Utilizadores distintos
          </div>
          <div className="text-xl font-semibold">{totalUsers}</div>
        </div>
      </div>

      {/* Lista de predictions em card único, como a lista de jogos */}
      <div className="rounded-2xl border border-white/10 bg-black/25 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Lista de predictions</h2>
          {loadingPredictions && (
            <span className="text-xs text-white/60">A carregar…</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-black/40">
              <tr>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">
                  Utilizador
                </th>
                <th className="px-3 py-2 text-center text-xs uppercase tracking-wide text-white/50">
                  Resultado
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">
                  Marcador
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-white/50">
                  Data / hora
                </th>
              </tr>
            </thead>
            <tbody>
              {predictions.length === 0 && !loadingPredictions && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-sm text-white/60"
                  >
                    Ainda não há predictions para este jogo.
                  </td>
                </tr>
              )}

              {predictions.map((p, idx) => {
                const resultLabel =
                  p.pred_home != null && p.pred_away != null
                    ? `${p.pred_home}–${p.pred_away}`
                    : '-';

                let scorerLabel: string;
                if (p.pred_scorer_name === null) {
                  // null == "ninguém" explicitamente escolhido
                  scorerLabel = '--';
                } else if (!p.pred_scorer_name) {
                  scorerLabel = '-';
                } else {
                  scorerLabel = p.pred_scorer_name;
                }

                return (
                  <tr
                    key={p.id}
                    className={
                      idx % 2 === 0
                        ? 'bg-black/20'
                        : 'bg-black/10'
                    }
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {p.user_name}
                    </td>
                    <td className="px-3 py-2 text-center font-mono">
                      {resultLabel}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {scorerLabel}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-white/70">
                      {formatDateTime(p.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast simples (igual ao dos fixtures) */}
      {msg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-sm shadow-lg">
          {msg}
        </div>
      )}
    </main>
  );
}

export default function AdminPredictionsPage() {
  return (
    <AdminGate>
      <AdminPredictionsInner />
    </AdminGate>
  );
}
