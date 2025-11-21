// apps/web/app/premios/page.tsx
'use client';

import Link from 'next/link';
import clsx from 'clsx';

export default function PremiosPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <title>+Predictor - Prémios</title>
      <header className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-white/40">
          O que podes ganhar com o +Predictor
        </p>
        <h1 className="mb-3 text-3xl font-bold md:text-4xl">Prémios</h1>
        <p className="max-w-2xl text-sm text-white/70 md:text-base">
          Consulta os principais prémios do +Predictor: ranking geral, ranking mensal, melhores
          palpites por jogo e experiências especiais em parceria com a Betano.
        </p>
      </header>

      {/* Destaques principais */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card
          title="Ranking Geral — Camisola Oficial do FC Porto"
          imageSrc="/win-icons-01.svg"
          imageAlt="Camisola de futebol azul e branca em destaque"
          imageClassName="h-60 w-auto object-contain md:h-76"
        >
          <p className="text-white/80">
            O vencedor do <span className="font-medium">ranking geral</span> recebe uma{' '}
            <span className="font-semibold">camisola oficial do FC Porto</span> (época atual), tamanho
            e personalização a combinar mediante disponibilidade.
          </p>
        </Card>

        <Card
          title="Ranking Mensal — Freebets 30€ / 20€ / 10€"
          imageSrc="/win-icons-03.svg"
          imageAlt="Freebets Betano"
        >
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

        <Card
          title="Vencedor da Jornada Europeia — Experiência Betano"
          imageSrc="/win-icons-04.svg"
          imageAlt="Experiência Betano"
        >
          <p className="text-white/80">
            Em cada jornada da <span className="font-medium">Europa League</span>, o participante com a
            <span className="font-semibold"> maior pontuação</span> ganha uma{' '}
            <span className="font-semibold">Experiência Betano</span>:
            <span className="font-semibold"> bilhete duplo para jogo no Dragão</span>.
          </p>
        </Card>

        <Card
          title="Vencedor por Jogo — Freebet 10€"
          imageSrc="/win-icons-02.svg"
          imageAlt="Freebets Betano"
        >
          <p className="text-white/80">
            Em cada jogo, o melhor palpite (maior pontuação) ganha uma{' '}
            <span className="font-semibold">freebet de 10€</span>.
          </p>
          <br />
        </Card>

        {/* <Card title="Sorteios — 🎟️ Bilhetes, Freebets & Experiências">
          <p className="text-white/80">
            Ao longo da temporada, realizaremos <span className="font-semibold">sorteios</span> para a
            comunidade: bilhetes de jogo, freebets e experiências exclusivas.
          </p>
          <ul className="mt-4 space-y-2 text-white/70 text-sm">
            <li>• Elegibilidade definida em cada campanha.</li>
            <li>• Comunicação no Instagram do MaisFCPorto e dentro da app.</li>
          </ul>
        </Card> */}
      </div>

      {/* Nota legal curta */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
        <p className="leading-relaxed">
          <span className="font-medium">Notas:</span> os prémios podem estar sujeitos a
          disponibilidade, validações de conta e termos do parceiro. Freebets são atribuídas a
          contas Betano válidas e verificadas. Reservamo-nos o direito de ajustar as condições
          dos prémios por razões operacionais ou legais.
          <br />
          Em caso de empate, são aplicados os critérios de desempate em{' '}
              <Link href="/regras" className="underline decoration-white/30 hover:decoration-white">
                Regras
              </Link>
        </p>
      </div>
    </main>
  );
}

/* ---------- UI helpers ---------- */

function Card({
  title,
  imageSrc,
  imageAlt,
  imageClassName,
  children,
}: {
  title: string;
  imageSrc?: string;
  imageAlt?: string;
  imageClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.015] p-5 shadow-[0_8px_40px_rgba(0,0,0,0.35)] md:p-6">
      <h2 className="mb-3 text-base font-semibold tracking-tight md:text-lg">{title}</h2>
      {children}
      {imageSrc ? (
        <div className="mt-4 overflow-hidden rounded-2xl bg-black/10 flex items-center justify-center p-3 md:p-4">
          <img
            src={imageSrc}
            alt={imageAlt ?? title}
            className={clsx('h-44 w-auto object-contain md:h-52', imageClassName)}
            loading="lazy"
          />
        </div>
      ) : null}
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
