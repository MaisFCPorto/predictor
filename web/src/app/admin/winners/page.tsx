'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import AdminGate from '../_components/AdminGate';

type GameWinnerRow = {
  fixture_id: string;
  kickoff_at: string;
  home_team_name: string;
  away_team_name: string;
  user_id: string;
  name: string;
  email: string | null;
};

type MonthlyWinnerRow = {
  ym: string;
  user_id: string;
  name: string;
  email: string | null;
};

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`(${res.status}) ${res.statusText}${txt ? ` — ${txt.slice(0, 160)}…` : ''}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Resposta não-JSON: ${txt.slice(0, 160)}…`);
  }
  return res.json();
}

function currentYM() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

function formatYmLabel(ym: string) {
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  const month = d.toLocaleDateString('pt-PT', { month: 'long' });
  const cap = month.charAt(0).toUpperCase() + month.slice(1);
  const yy = String(d.getFullYear()).slice(-2);
  return `${cap}'${yy}`;
}

function fmtLocalDT(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default function WinnersPage() {
  return (
    <AdminGate>
      <Suspense
        fallback={
          <main className="mx-auto max-w-6xl p-6">
            <title>+Predictor - Vencedores</title>
            <h1 className="text-3xl font-bold tracking-tight">Vencedores</h1>
            <div className="mt-4 text-sm text-white/70">A carregar…</div>
          </main>
        }
      >
        <WinnersPageInner />
      </Suspense>
    </AdminGate>
  );
}

function WinnersPageInner() {
  const [months, setMonths] = useState<string[]>([]);
  const [ym, setYm] = useState<string>(currentYM());

  const [gameRows, setGameRows] = useState<GameWinnerRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyWinnerRow[]>([]);

  const [loadingGames, setLoadingGames] = useState(false);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [errGames, setErrGames] = useState<string | null>(null);
  const [errMonthly, setErrMonthly] = useState<string | null>(null);

  useEffect(() => {
    fetchJson('/api/winners/months')
      .then((list: string[]) => {
        const arr = Array.isArray(list) ? list : [];
        setMonths(arr);
        if (arr.length) {
          if (arr.includes(currentYM())) setYm(currentYM());
          else setYm(arr[0]);
        }
      })
      .catch(() => setMonths([]));
  }, []);

  useEffect(() => {
    setLoadingGames(true);
    setErrGames(null);
    fetchJson(`/api/winners?ym=${encodeURIComponent(ym)}`)
      .then((data: GameWinnerRow[]) => {
        const arr = Array.isArray(data) ? data : [];
        setGameRows(arr);
      })
      .catch((e: any) => setErrGames(e?.message ?? 'Erro a carregar vencedores por jogo'))
      .finally(() => setLoadingGames(false));
  }, [ym]);

  useEffect(() => {
    setLoadingMonthly(true);
    setErrMonthly(null);
    fetchJson(`/api/winners/monthly?ym=${encodeURIComponent(ym)}`)
      .then((data: MonthlyWinnerRow[]) => {
        const arr = Array.isArray(data) ? data : [];
        setMonthlyRows(arr);
      })
      .catch((e: any) => setErrMonthly(e?.message ?? 'Erro a carregar top 3 mensal'))
      .finally(() => setLoadingMonthly(false));
  }, [ym]);

  const gameTitle = useMemo(() => `Vencedores por Jogo — ${formatYmLabel(ym)}`, [ym]);
  const monthlyTitle = useMemo(() => `Top 3 Mensal — ${formatYmLabel(ym)}`, [ym]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <title>+Predictor - Vencedores</title>
      <h1 className="text-3xl font-bold tracking-tight">Vencedores</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="ml-1 inline-flex items-center gap-2 text-sm text-white/70">
          <span>Mês</span>
          <select
            className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-white/90 outline-none focus:ring-2 focus:ring-white/20"
            value={ym}
            onChange={(e) => setYm(e.target.value)}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {formatYmLabel(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] shadow-[0_10px_50px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
            {gameTitle}
          </span>
        </div>

        {errGames && <div className="px-5 py-3 text-sm text-red-300">{errGames}</div>}
        {loadingGames && !errGames && (
          <div className="px-5 py-3 text-sm text-white/70">A carregar…</div>
        )}

        {!loadingGames && !errGames && (
          <div className="block sm:hidden">
            {gameRows.length === 0 ? (
              <div className="px-5 py-8 text-center text-white/60">Sem resultados para mostrar.</div>
            ) : (
              <ul className="divide-y divide-white/10">
                {gameRows.map((r) => (
                  <li key={r.fixture_id} className="px-5 py-4">
                    <div className="text-xs text-white/60">{fmtLocalDT(r.kickoff_at)}</div>
                    <div className="mt-1 font-medium">
                      {r.home_team_name} vs {r.away_team_name}
                    </div>
                    <div className="mt-2 rounded-2xl bg-white/[0.04] px-3 py-2">
                      <div className="text-sm font-semibold">{r.name}</div>
                      <div className="mt-0.5 text-xs text-white/70">{r.email ?? '—'}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!loadingGames && !errGames && (
          <div className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="bg-white/[0.05] text-left">
                    <th className="px-5 py-3 whitespace-nowrap">Jogo</th>
                    <th className="px-5 py-3 whitespace-nowrap">User</th>
                    <th className="px-5 py-3 whitespace-nowrap">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {gameRows.length === 0 ? (
                    <tr>
                      <td className="px-5 py-6 text-center text-white/60" colSpan={3}>
                        Sem resultados para mostrar.
                      </td>
                    </tr>
                  ) : (
                    gameRows.map((r) => (
                      <tr
                        key={r.fixture_id}
                        className="border-t border-white/10 odd:bg-white/[0.02] hover:bg-white/[0.05] transition"
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium">
                            {r.home_team_name} vs {r.away_team_name}
                          </div>
                          <div className="mt-0.5 text-xs text-white/60">{fmtLocalDT(r.kickoff_at)}</div>
                        </td>
                        <td className="px-5 py-3 font-medium">{r.name}</td>
                        <td className="px-5 py-3 text-white/80">{r.email ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] shadow-[0_10px_50px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
            {monthlyTitle}
          </span>
        </div>

        {errMonthly && <div className="px-5 py-3 text-sm text-red-300">{errMonthly}</div>}
        {loadingMonthly && !errMonthly && (
          <div className="px-5 py-3 text-sm text-white/70">A carregar…</div>
        )}

        {!loadingMonthly && !errMonthly && (
          <div className="block sm:hidden">
            {monthlyRows.length === 0 ? (
              <div className="px-5 py-8 text-center text-white/60">Sem resultados para mostrar.</div>
            ) : (
              <ul className="divide-y divide-white/10">
                {monthlyRows.map((r) => (
                  <li key={`${r.ym}-${r.user_id}`} className="px-5 py-4">
                    <div className="text-xs text-white/60">{formatYmLabel(r.ym)}</div>
                    <div className="mt-1 font-semibold">{r.name}</div>
                    <div className="mt-0.5 text-xs text-white/70">{r.email ?? '—'}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!loadingMonthly && !errMonthly && (
          <div className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="bg-white/[0.05] text-left">
                    <th className="px-5 py-3 whitespace-nowrap">Mês</th>
                    <th className="px-5 py-3 whitespace-nowrap">User</th>
                    <th className="px-5 py-3 whitespace-nowrap">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.length === 0 ? (
                    <tr>
                      <td className="px-5 py-6 text-center text-white/60" colSpan={3}>
                        Sem resultados para mostrar.
                      </td>
                    </tr>
                  ) : (
                    monthlyRows.map((r) => (
                      <tr
                        key={`${r.ym}-${r.user_id}`}
                        className="border-t border-white/10 odd:bg-white/[0.02] hover:bg-white/[0.05] transition"
                      >
                        <td className="px-5 py-3 text-white/80">{formatYmLabel(r.ym)}</td>
                        <td className="px-5 py-3 font-medium">{r.name}</td>
                        <td className="px-5 py-3 text-white/80">{r.email ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
