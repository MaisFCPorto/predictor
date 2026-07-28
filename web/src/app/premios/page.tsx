'use client';

import Link from 'next/link';

export default function PremiosPage() {
  return (
    <main className="page-shell">
      <title>+Predictor - Prémios</title>

      <header className="page-header">
        <p className="eyebrow">Em jogo esta época</p>
        <h1 className="display-title">Prémios que dão ainda mais peso a cada palpite.</h1>
        <p className="page-copy">
          Da camisola oficial às experiências no Dragão, cada ranking tem uma recompensa clara.
        </p>
      </header>

      <section className="surface-strong relative overflow-hidden p-6 md:p-9">
        <div className="relative z-10 grid items-center gap-7 md:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="eyebrow">Prémio da época</p>
            <h2 className="section-title max-w-xl text-[2.25rem] md:text-[3.25rem]">
              Camisola oficial do FC Porto
            </h2>
            <p className="page-copy mt-4">
              O primeiro classificado do ranking geral recebe a camisola oficial da época atual.
              Tamanho e personalização ficam sujeitos a disponibilidade.
            </p>
            <Link href="/rankings" className="action-button mt-6">
              Ver ranking geral
            </Link>
          </div>

          <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#06102b]/70">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(40,120,255,.25),transparent_62%)]" />
            <img
              src="/win-icons-01.svg"
              alt="Camisola oficial do FC Porto"
              className="relative z-10 h-56 w-auto object-contain md:h-72"
            />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Consistência premiada</p>
            <h2 className="section-title">Pódio mensal</h2>
          </div>
          <span className="section-meta">Freebets Betano</span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <MonthlyPrize place="1.º" value="30€" note="Liderança mensal" featured />
          <MonthlyPrize place="2.º" value="20€" note="Segundo classificado" />
          <MonthlyPrize place="3.º" value="10€" note="Terceiro classificado" />
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <PrizeStory
          eyebrow="Jornada europeia"
          title="Bilhete duplo para o Dragão"
          copy="O melhor participante de cada jornada europeia ganha uma Experiência Betano com bilhete duplo."
          image="/win-icons-04.svg"
        />
        <PrizeStory
          eyebrow="Cada jogo conta"
          title="Freebet de 10€"
          copy="O palpite com maior pontuação em cada jogo recebe uma freebet de 10€ na Betano."
          image="/win-icons-02.svg"
        />
      </section>

      <aside className="surface mt-8 px-5 py-4 text-sm leading-relaxed text-white/60">
        Os prémios dependem de disponibilidade, validação da conta e condições do parceiro.
        Em caso de empate aplicam-se os critérios descritos nas{' '}
        <Link href="/regras" className="text-white underline decoration-white/30 underline-offset-4">
          regras do +Predictor
        </Link>.
      </aside>
    </main>
  );
}

function MonthlyPrize({
  place,
  value,
  note,
  featured = false,
}: {
  place: string;
  value: string;
  note: string;
  featured?: boolean;
}) {
  return (
    <article
      className={
        featured
          ? 'surface-strong relative min-h-44 overflow-hidden p-5'
          : 'surface relative min-h-44 overflow-hidden p-5'
      }
    >
      <div className="metric-label">{place} lugar</div>
      <div className="metric-value mt-5">{value}</div>
      <div className="metric-caption">{note}</div>
      {featured && (
        <div className="absolute -bottom-12 -right-10 h-36 w-36 rounded-full bg-blue-500/20 blur-2xl" />
      )}
    </article>
  );
}

function PrizeStory({
  eyebrow,
  title,
  copy,
  image,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  image: string;
}) {
  return (
    <article className="surface grid min-h-64 grid-cols-[1fr_130px] gap-4 overflow-hidden p-5 md:grid-cols-[1fr_170px] md:p-6">
      <div className="self-center">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="section-title text-[1.75rem]">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/65">{copy}</p>
      </div>
      <div className="flex items-center justify-center bg-white/[0.025]">
        <img src={image} alt="" className="max-h-44 w-full object-contain p-3" />
      </div>
    </article>
  );
}
