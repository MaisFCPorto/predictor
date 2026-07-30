'use client';

import { useEffect, useState } from 'react';
import RequireAuth from '@/components/RequireAuth';
import { adm } from './_utils/adminClients';

type TrendPair = {
  current: number;
  previous: number;
};

type DashboardTrends = {
  registrations: {
    season: {
      current: number;
      start_date: string;
    };
    today: TrendPair;
  };
  predictions: TrendPair;
  participation: TrendPair;
  current_fixture: {
    id: string;
    label: string;
    kickoff_at: string;
  } | null;
  previous_fixture: {
    id: string;
    label: string;
    kickoff_at: string;
  } | null;
};

type TrendCardProps = {
  label: string;
  value: string;
  current: number;
  previous: number;
  comparison: string;
  detail?: string | null;
  mode?: 'percent' | 'percentage-points';
  loading?: boolean;
  showTrend?: boolean;
};

function trendPresentation(
  current: number,
  previous: number,
  mode: 'percent' | 'percentage-points',
) {
  const difference = current - previous;
  const direction = difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat';

  if (mode === 'percentage-points') {
    const absolute = Math.abs(difference);
    return {
      direction,
      label: `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${absolute.toLocaleString(
        'pt-PT',
        { minimumFractionDigits: 1, maximumFractionDigits: 1 },
      )} pp`,
    };
  }

  if (previous === 0) {
    return {
      direction,
      label: current > 0 ? 'Novo' : 'Sem alteração',
    };
  }

  const percentage = Math.abs((difference / previous) * 100);
  return {
    direction,
    label: `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${percentage.toLocaleString(
      'pt-PT',
      { maximumFractionDigits: percentage < 10 ? 1 : 0 },
    )}%`,
  };
}

function TrendCard({
  label,
  value,
  current,
  previous,
  comparison,
  detail,
  mode = 'percent',
  loading = false,
  showTrend = true,
}: TrendCardProps) {
  const trend = trendPresentation(current, previous, mode);
  const trendClass =
    trend.direction === 'up'
      ? 'text-emerald-400'
      : trend.direction === 'down'
        ? 'text-red-400'
        : 'text-white/45';
  const arrow =
    trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→';

  return (
    <article className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-3">
      <p className="truncate text-[11px] font-medium text-white/55">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <strong className="text-2xl font-semibold leading-none text-white">
          {loading ? '—' : value}
        </strong>
        {!loading && showTrend && (
          <span className={`shrink-0 text-xs font-semibold ${trendClass}`}>
            {arrow} {trend.label}
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-[10px] text-white/35" title={detail ?? comparison}>
        {detail ?? comparison}
      </p>
    </article>
  );
}

export default function AdminIndex() {
  const [trends, setTrends] = useState<DashboardTrends | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [trendsError, setTrendsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTrends() {
      try {
        setLoadingTrends(true);
        setTrendsError(false);
        const { data } = await adm.get<DashboardTrends>(
          '/api/admin/dashboard/trends',
          { headers: { 'cache-control': 'no-store' } },
        );
        if (!cancelled) setTrends(data);
      } catch {
        if (!cancelled) {
          setTrends(null);
          setTrendsError(true);
        }
      } finally {
        if (!cancelled) setLoadingTrends(false);
      }
    }

    void loadTrends();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentFixtureLabel = trends?.current_fixture?.label ?? null;
  const previousFixtureLabel = trends?.previous_fixture?.label ?? null;

  return (
    <RequireAuth>
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <title>+Predictor - Backoffice</title>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gradient">
            Backoffice
          </h1>
          <p className="max-w-2xl text-sm text-white/60">
            Gere utilizadores, equipas, jogos e previsões numa vista centralizada.
          </p>
        </header>

        <div className="-mx-6 overflow-x-auto px-6 pb-1">
          <section className="grid min-w-[780px] grid-cols-4 gap-3 lg:min-w-0">
            <TrendCard
              label="Registos na época"
              value={(trends?.registrations.season.current ?? 0).toLocaleString('pt-PT')}
              current={trends?.registrations.season.current ?? 0}
              previous={0}
              comparison="desde 28 de julho"
              loading={loadingTrends}
              showTrend={false}
            />
            <TrendCard
              label="Registos hoje"
              value={(trends?.registrations.today.current ?? 0).toLocaleString('pt-PT')}
              current={trends?.registrations.today.current ?? 0}
              previous={trends?.registrations.today.previous ?? 0}
              comparison="vs ontem até esta hora"
              loading={loadingTrends}
            />
            <TrendCard
              label="Palpites no jogo"
              value={(trends?.predictions.current ?? 0).toLocaleString('pt-PT')}
              current={trends?.predictions.current ?? 0}
              previous={trends?.predictions.previous ?? 0}
              comparison="vs último jogo"
              detail={
                currentFixtureLabel
                  ? `${currentFixtureLabel} · vs ${previousFixtureLabel ?? 'último jogo'}`
                  : 'Sem jogo aberto'
              }
              loading={loadingTrends}
            />
            <TrendCard
              label="Taxa de participação"
              value={`${(trends?.participation.current ?? 0).toLocaleString('pt-PT', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}%`}
              current={trends?.participation.current ?? 0}
              previous={trends?.participation.previous ?? 0}
              comparison="palpites ÷ utilizadores · vs último jogo"
              mode="percentage-points"
              loading={loadingTrends}
            />
          </section>
        </div>

        {trendsError && (
          <p className="-mt-3 text-xs text-white/35">
            Não foi possível carregar as tendências agora.
          </p>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AdminCard href="/admin/users" title="Users" description="Gerir utilizadores." />
          <AdminCard href="/admin/teams" title="Equipas" description="Configurar equipas." />
          <AdminCard
            href="/admin/players"
            title="Jogadores"
            description="Gerir o plantel e disponibilidade no seletor de marcadores."
          />
          <AdminCard
            href="/admin/competitions"
            title="Competições"
            description="Criar competições e definir a respetiva identidade visual."
          />
          <AdminCard
            href="/admin/fixtures"
            title="Jogos"
            description="Gerir calendário, resultados finais e estado dos jogos."
          />
          <AdminCard
            href="/admin/predictions"
            title="Predictions"
            description="Inspecionar predictions registadas."
          />
          <AdminCard
            href="/admin/winners"
            title="Vencedores"
            description="Consultar vencedores por meses e jogo."
          />
        </section>
      </main>
    </RequireAuth>
  );
}

function AdminIcon({ title }: { title: string }) {
  const t = title.toLowerCase();

  if (t.includes('user')) {
    return (
      <svg className="h-3.5 w-3.5 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" />
      </svg>
    );
  }

  if (t.includes('equipa') || t.includes('team')) {
    return (
      <svg className="h-3.5 w-3.5 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l7 2v6c0 4.2-2.7 8-7 10-4.3-2-7-5.8-7-10V5l7-2z" />
        <path d="M9 9h6" />
      </svg>
    );
  }

  if (t.includes('jogador') || t.includes('plantel')) {
    return (
      <svg className="h-3.5 w-3.5 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="7" r="3" />
        <path d="M7 21l1.5-7 3.5-2 3.5 2L17 21" />
        <path d="M9 16l-3 2" />
        <path d="M15 16l3 2" />
      </svg>
    );
  }

  if (t.includes('competi') || t.includes('jornada')) {
    return (
      <svg className="h-3.5 w-3.5 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M9 3v4" />
        <path d="M15 3v4" />
        <path d="M4 10h16" />
        <path d="M9 14h2" />
        <path d="M13 14h2" />
      </svg>
    );
  }

  if (t.includes('jogos') || t.includes('jogo') || t.includes('fixtures')) {
    return (
      <svg className="h-3.5 w-3.5 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="8" />
        <path d="M9 9l2-3 2 3-2 2-2-2z" />
        <path d="M9 9l-3 2 1 3 3 1 1-2" />
        <path d="M15 9l3 2-1 3-3 1-1-2" />
      </svg>
    );
  }

  if (t.includes('prediction') || t.includes('previs')) {
    return (
      <svg className="h-3.5 w-3.5 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19h16" />
        <rect x="5" y="5" width="3" height="9" rx="1" />
        <rect x="10.5" y="8" width="3" height="6" rx="1" />
        <rect x="16" y="10" width="3" height="4" rx="1" />
      </svg>
    );
  }

  return (
    <svg className="h-3.5 w-3.5 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

type AdminCardProps = {
  href: string;
  title: string;
  description: string;
};

function AdminCard({ href, title, description }: AdminCardProps) {
  return (
    <a
      href={href}
      className="group rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:border-white/15 hover:bg-white/[0.04]"
    >
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-base font-medium text-white/90">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06]">
            <AdminIcon title={title} />
          </span>
          <span>{title}</span>
        </h2>
        <p className="text-xs leading-snug text-white/50">{description}</p>
        <span className="mt-1 inline-flex items-center text-xs font-medium text-sky-300/80 group-hover:text-sky-200">
          Abrir
          <svg className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </a>
  );
}
