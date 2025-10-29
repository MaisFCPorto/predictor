// apps/web/app/premios/page.tsx
'use client';

import clsx from 'clsx';

export default function PremiosPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <h1 className="mb-6 text-3xl font-bold">Prémios</h1>

      {/* Destaques principais */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Ranking Geral — 🥇 Camisola Oficial do FC Porto">
          <p className="text-white/80">
            O vencedor do <span className="font-medium">ranking geral</span> recebe uma{' '}
            <span className="font-semibold">camisola oficial do FC Porto</span> (época atual), tamanho
            e personalização a combinar mediante disponibilidade.
          </p>
          <ul className="mt-4 space-y-2 text-white/70 text-sm">
            <li>• Entrega após o término da competição definida para a época.</li>
            <li>• Em caso de empate: critérios em “Regras”.</li>
          </ul>
        </Card>

        <Card title="Ranking Mensal — 🎁 Freebets 30€ / 20€ / 10€">
          <p className="text-white/80">
            Todos os meses premiamos o pódio do ranking mensal com{' '}
            <span className="font-semibold">freebets</span>:
          </p>
          <ul className="mt-4 grid grid-cols-3 gap-3 text-center">
            <PrizePill label="1.º" value="30€" />
            <PrizePill label="2.º" value="20€" />
            <PrizePill label="3.º" value="10€" />
          </ul>
          <p className="mt-4 text-xs text-white/60">
            Freebets atribuídas via parceiro Betano, sujeitas a conta ativa e verificada.
          </p>
        </Card>

        <Card title="Vencedor por Jogo — 💥 Freebet 10€">
          <p className="text-white/80">
            Em cada jogo, o melhor palpite (maior pontuação) ganha uma{' '}
            <span className="font-semibold">freebet de 10€</span>.
          </p>
          <ul className="mt-4 space-y-2 text-white/70 text-sm">
            <li>• Em caso de empate, aplicam-se os critérios de desempate.</li>
            <li>• Apenas participantes elegíveis (ver “Regras”).</li>
          </ul>
        </Card>

        <Card title="Sorteios — 🎟️ Bilhetes, Freebets & Experiências">
          <p className="text-white/80">
            Ao longo da temporada, realizaremos <span className="font-semibold">sorteios</span> para a
            comunidade: bilhetes de jogo, freebets e experiências exclusivas.
          </p>
          <ul className="mt-4 space-y-2 text-white/70 text-sm">
            <li>• Elegibilidade definida em cada campanha.</li>
            <li>• Comunicação no Instagram do MaisFCPorto e dentro da app.</li>
          </ul>
        </Card>
      </div>

      {/* Nota legal curta */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
        <p className="leading-relaxed">
          <span className="font-medium">Notas:</span> os prémios podem estar sujeitos a
          disponibilidade, validações de conta e termos do parceiro. Freebets são atribuídas a
          contas Betano válidas e verificadas. Reservamo-nos o direito de ajustar as condições
          dos prémios por razões operacionais ou legais.
        </p>
      </div>
    </main>
  );
}

/* ---------- UI helpers ---------- */

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6 shadow-[0_8px_40px_rgba(0,0,0,0.35)]">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function PrizePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
