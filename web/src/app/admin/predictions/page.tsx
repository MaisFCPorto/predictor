'use client';

import { useEffect, useState } from 'react';
import AdminGate from '../_components/AdminGate';

type AdminFixtureOption = {
  id: string;
  label: string; // ex: "2025-11-20 – FC Porto vs Benfica"
};

type AdminPredictionRow = {
  id: string;
  user_name: string;
  pred_home: number | null;
  pred_away: number | null;
  pred_scorer_name: string | null; // nome do marcador (ou null)
  created_at: string; // ISO
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY ?? '';

function AdminPredictionsInner() {
  const [fixtures, setFixtures] = useState<AdminFixtureOption[]>([]);
  const [selectedFixtureId, setSelectedFixtureId] = useState('');
  const [predictions, setPredictions] = useState<AdminPredictionRow[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar lista de jogos para o selector
  useEffect(() => {
    if (!API_URL) {
      setError('API URL não configurado (NEXT_PUBLIC_API_URL).');
      return;
    }

    const loadFixtures = async () => {
      try {
        setLoadingFixtures(true);
        setError(null);

        const res = await fetch(`${API_URL}/admin/predictions/fixtures`, {
          headers: {
            'x-admin-key': ADMIN_KEY,
          },
        });

        if (!res.ok) {
          throw new Error(`Erro ao carregar jogos (${res.status})`);
        }

        const data = await res.json();
        const list: AdminFixtureOption[] = data.fixtures ?? [];
        setFixtures(list);

        if (list.length > 0) {
          setSelectedFixtureId(list[0].id);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? 'Erro ao carregar jogos');
      } finally {
        setLoadingFixtures(false);
      }
    };

    loadFixtures();
  }, []);

  // Carregar predictions de um jogo
  useEffect(() => {
    if (!API_URL) return;
    if (!selectedFixtureId) {
      setPredictions([]);
      return;
    }

    const loadPredictions = async () => {
      try {
        setLoadingPredictions(true);
        setError(null);

        const res = await fetch(
          `${API_URL}/admin/predictions/fixture/${selectedFixtureId}`,
          {
            headers: {
              'x-admin-key': ADMIN_KEY,
            },
          }
        );

        if (!res.ok) {
          throw new Error(`Erro ao carregar predictions (${res.status})`);
        }

        const data = await res.json();
        const list: AdminPredictionRow[] = data.predictions ?? [];
        setPredictions(list);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? 'Erro ao carregar predictions');
      } finally {
        setLoadingPredictions(false);
      }
    };

    loadPredictions();
  }, [selectedFixtureId]);

  const selectedFixture =
    fixtures.find((f) => f.id === selectedFixtureId) ?? null;

  const totalUsers = new Set(predictions.map((p) => p.user_name)).size;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">
              Predictions por jogo
            </h1>
            <p className="text-sm text-slate-400">
              Consulta todas as previsões (resultado + marcador) submetidas para
              um jogo específico.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-300">Jogo:</label>
            <select
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm min-w-[240px]"
              value={selectedFixtureId}
              disabled={loadingFixtures || fixtures.length === 0}
              onChange={(e) => setSelectedFixtureId(e.target.value)}
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
        </header>

        {/* Erros */}
        {error && (
          <div className="border border-red-500/40 bg-red-500/10 text-red-100 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Cards de resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="border border-slate-700 bg-slate-900/60 rounded-xl px-4 py-3 text-sm">
            <div className="text-slate-400">Jogo selecionado</div>
            <div className="mt-1 font-medium text-slate-50">
              {selectedFixture ? selectedFixture.label : 'Nenhum'}
            </div>
          </div>
          <div className="border border-slate-700 bg-slate-900/60 rounded-xl px-4 py-3 text-sm">
            <div className="text-slate-400">Total de predictions</div>
            <div className="mt-1 font-semibold text-slate-50">
              {predictions.length}
            </div>
          </div>
          <div className="border border-slate-700 bg-slate-900/60 rounded-xl px-4 py-3 text-sm">
            <div className="text-slate-400">Utilizadores distintos</div>
            <div className="mt-1 font-semibold text-slate-50">
              {totalUsers}
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="border border-slate-800 bg-slate-900/60 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between text-sm">
            <span className="font-medium">Lista de predictions</span>
            {loadingPredictions && (
              <span className="text-xs text-slate-400">A carregar…</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/80 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400">
                    Utilizador
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-slate-400">
                    Resultado
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400">
                    Marcador
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400">
                    Data / hora
                  </th>
                </tr>
              </thead>
              <tbody>
                {predictions.length === 0 && !loadingPredictions && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-sm text-slate-400"
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
                    // null == "ninguém" (escolha explícita)
                    scorerLabel = 'Ninguém';
                  } else if (!p.pred_scorer_name) {
                    // vazio/undefined -> não escolheu ninguém
                    scorerLabel = '-';
                  } else {
                    scorerLabel = p.pred_scorer_name;
                  }

                  const dt = new Date(p.created_at);
                  const dateLabel = isNaN(dt.getTime())
                    ? p.created_at
                    : dt.toLocaleString('pt-PT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                  return (
                    <tr
                      key={p.id}
                      className={
                        idx % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-950/10'
                      }
                    >
                      <td className="px-4 py-2 whitespace-nowrap">
                        {p.user_name}
                      </td>
                      <td className="px-4 py-2 text-center font-mono">
                        {resultLabel}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {scorerLabel}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-slate-300">
                        {dateLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPredictionsPage() {
  return (
    <AdminGate>
      <AdminPredictionsInner />
    </AdminGate>
  );
}
