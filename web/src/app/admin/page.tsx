'use client';
import RequireAuth from '@/components/RequireAuth';

export default function AdminIndex() {
  // no futuro: validar role admin e mostrar 403 se não for
  return (
    <RequireAuth>
      <main className="mx-auto max-w-5xl p-6 space-y-6">
        <title>+Predictor - Backoffice</title>

        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gradient">
            Backoffice
          </h1>
          <p className="text-sm text-white/70 max-w-2xl">
            Gere utilizadores, equipas, jornadas, jogos e previsões numa vista
            centralizada. Estas ferramentas afetam diretamente a experiência
            no +Predictor.
          </p>
        </header>

        {/* Grid de secções */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AdminCard
            href="/admin/users"
            title="Users"
            description="Gerir utilizadores."
          />
          <AdminCard
            href="/admin/teams"
            title="Equipas"
            description="Configurar equipas."
          />
          <AdminCard
            href="/admin/matchdays"
            title="Competições / Jornadas"
            description="Definir competições, jornadas e janelas temporais."
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
        </section>
      </main>
    </RequireAuth>
  );
}

function AdminIcon({ title }: { title: string }) {
  const t = title.toLowerCase();

  if (t.includes('user')) {
    // Users icon
    return (
      <svg
        className="h-3.5 w-3.5 text-white/80"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" />
      </svg>
    );
  }

  if (t.includes('equipa') || t.includes('team')) {
    // Teams icon (shield)
    return (
      <svg
        className="h-3.5 w-3.5 text-white/80"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 3l7 2v6c0 4.2-2.7 8-7 10-4.3-2-7-5.8-7-10V5l7-2z" />
        <path d="M9 9h6" />
      </svg>
    );
  }

  if (t.includes('competi') || t.includes('jornada')) {
    // Matchdays / competitions icon (calendar)
    return (
      <svg
        className="h-3.5 w-3.5 text-white/80"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
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
    // Fixtures / games icon (ball)
    return (
      <svg
        className="h-3.5 w-3.5 text-white/80"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M9 9l2-3 2 3-2 2-2-2z" />
        <path d="M9 9l-3 2 1 3 3 1 1-2" />
        <path d="M15 9l3 2-1 3-3 1-1-2" />
      </svg>
    );
  }

  if (t.includes('prediction') || t.includes('previs')) {
    // Predictions icon (chart/list)
    return (
      <svg
        className="h-3.5 w-3.5 text-white/80"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 19h16" />
        <rect x="5" y="5" width="3" height="9" rx="1" />
        <rect x="10.5" y="8" width="3" height="6" rx="1" />
        <rect x="16" y="10" width="3" height="4" rx="1" />
      </svg>
    );
  }

  // Default: document/text icon
  return (
    <svg
      className="h-3.5 w-3.5 text-white/80"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
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
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:bg-white/[0.06] hover:border-white/25 hover:-translate-y-0.5"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-20 pointer-events-none bg-gradient-to-tr from-sky-500/40 via-emerald-400/30 to-violet-500/40 blur-2xl transition" />
      <div className="relative flex flex-col gap-2">
        <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
            <AdminIcon title={title} />
          </span>
          <span>{title}</span>
        </h2>
        <p className="text-xs sm:text-sm text-white/70 leading-snug">
          {description}
        </p>
        <span className="mt-2 inline-flex items-center text-xs font-medium text-sky-300 group-hover:text-sky-200">
          Abrir
          <svg
            className="ml-1 h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </a>
  );
}
