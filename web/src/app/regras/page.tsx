// apps/web/app/regras/page.tsx
'use client';

import Link from 'next/link';

export default function RegrasPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <header className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-white/40">
          Como funciona o +Predictor
        </p>
        <h1 className="mb-3 text-3xl font-bold md:text-4xl">Regras</h1>
        <p className="max-w-2xl text-sm text-white/70 md:text-base">
          Aqui encontras um resumo simples de quem pode participar, como funcionam os
          palpites, a pontuação e o que é preciso para estares elegível aos prémios.
        </p>
      </header>

      {/* Sumário rápido / TOC */}
      <div className="mb-8 grid gap-3 md:grid-cols-2">
        <AnchorCard title="Quem pode participar" href="#quem-pode-participar" />
        <AnchorCard title="Como funciona" href="#como-funciona" />
        <AnchorCard title="Pontuação" href="#pontuacao" />
        <AnchorCard title="Fecho e bloqueios" href="#fecho" />
        <AnchorCard title="Desempates" href="#desempates" />
        <AnchorCard title="Elegibilidade aos prémios" href="#elegibilidade" />
        <AnchorCard title="Conduta e fair-play" href="#conduta" />
        <AnchorCard title="Privacidade" href="#privacidade" />
      </div>

      <RuleCard id="quem-pode-participar" title="Quem pode participar">
        <ul className="space-y-2 text-white/80">
          <li>• Ser <span className="font-medium">maior de 18 anos</span>.</li>
          <li>• Ter um registo válido na plataforma (email ou Google).</li>
          <li>
            • Seguir o Instagram{' '}
            <a
              href="https://instagram.com/maisfcporto"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-white/30 hover:decoration-white"
            >
              @maisfcporto
            </a>{' '}
            para acompanhar avisos e sorteios.
          </li>
          <li>
            • Registo na Betano através do nosso link de parceiro (necessário para prémios em
            freebets):{' '}
            <a
              href="https://gml-grp.com/C.ashx?btag=a_15985b_289c_&affid=5177&siteid=15985&adid=289&c=&asclurl=https://promos.betano.pt/confia-fcporto/index.html?cod=MAISFCP"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-white/30 hover:decoration-white"
            >
              criar conta Betano
            </a>.
          </li>
        </ul>
      </RuleCard>

      <RuleCard id="como-funciona" title="Como funciona">
        <ol className="list-decimal space-y-2 pl-5 text-white/80">
          <li>Consulta os jogos em “Jogos”.</li>
          <li>Insere o teu palpite de resultado (golos de cada equipa).</li>
          <li>Guarda o palpite antes do fecho (ver abaixo).</li>
          <li>Após o jogo, a pontuação é atribuída automaticamente.</li>
        </ol>
      </RuleCard>

      <RuleCard id="pontuacao" title="Pontuação">
        <ul className="space-y-2 text-white/80">
          <li>• <span className="font-semibold">Resultado exato</span>: 5 pontos</li>
          <li>• <span className="font-semibold">Diferença correta</span> (tendência e margem corretas): 3 pontos</li>
          <li>• <span className="font-semibold">Tendência correta</span> (vitória/empate/derrota): 1 ponto</li>
        </ul>
        <p className="mt-3 text-sm text-white/60">
          Ex.: jogo termina 2–1. Quem apostou 2–1 recebe 5; quem apostou 3–2 recebe 3;
          quem apostou 2–0 recebe 1; quem apostou 0–2 recebe 0.
        </p>
      </RuleCard>

      <RuleCard id="fecho" title="Fecho e bloqueios">
        <ul className="space-y-2 text-white/80">
          <li>• Os palpites fecham à hora para a qual o jogo está agendado.</li>
          <li>• Um contador indica quando o jogo será bloqueado.</li>
          <li>• Palpites após o fecho não são considerados.</li>
        </ul>
      </RuleCard>

      <RuleCard id="desempates" title="Critérios de desempate">
        <ol className="list-decimal space-y-2 pl-5 text-white/80">
          <li>Mais pontos totais;</li>
          <li>Mais acertos <span className="font-semibold">exatos</span>;</li>
          <li>Mais acertos de <span className="font-semibold">diferença</span>;</li>
          <li>
            Antiguidade do palpite (timestamp) - quem submeteu primeiro tem vantagem.
          </li>
        </ol>
      </RuleCard>

      <RuleCard id="elegibilidade" title="Elegibilidade aos prémios">
        <ul className="space-y-2 text-white/80">
          <li>• Maior de idade (18+).</li>
          <li>
            • Conta na plataforma válida e sem comportamentos abusivos (por exemplo, spam ou
            uso de múltiplas contas).
          </li>
          <li>
            • Seguir o Instagram @maisfcporto para comunicação, atualizações e validações.
          </li>
          <li>
            • Para freebets: conta Betano ativa, verificada e criada através do link de parceiro
            indicado.
          </li>
          <li>
            • Podemos solicitar prova de identidade e/ou dados mínimos apenas para efeitos de
            entrega dos prémios.
          </li>
        </ul>
      </RuleCard>

      <RuleCard id="conduta" title="Conduta e fair-play">
        <ul className="space-y-2 text-white/80">
          <li>• Proibido uso de múltiplas contas, bots ou manipulação.</li>
          <li>• Reservamo-nos o direito de excluir participantes que quebrem regras.</li>
        </ul>
      </RuleCard>

      <RuleCard id="privacidade" title="Privacidade e dados">
        <p className="text-white/80">
          Guardamos apenas os dados necessários ao funcionamento do jogo (conta,
          palpites e resultados). Podes pedir eliminação dos teus dados a qualquer momento.
          Para freebets/prémios, poderás ter de confirmar dados junto do parceiro.
        </p>
      </RuleCard>

      {/* CTA rápido */}
      <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-5 md:p-6">
        <div className="mb-4">
          <h2 className="mb-1 text-base font-semibold md:text-lg">Pronto para começar?</h2>
          <p className="text-sm text-white/70">
            Garante que cumpres os requisitos acima e usa os botões abaixo para seguir o projeto
            e criar a tua conta na Betano.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <CtaButton
            label="Seguir @maisfcporto"
            href="https://instagram.com/maisfcporto"
          />
          <CtaButton
            label="Criar conta Betano"
            href="https://gml-grp.com/C.ashx?btag=a_15985b_289c_&affid=5177&siteid=15985&adid=289&c=&asclurl=https://promos.betano.pt/confia-fcporto/index.html?cod=MAISFCP"
          />
        </div>
      </section>
    </main>
  );
}

/* ---------- UI ---------- */

function AnchorCard({ title, href }: { title: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80 shadow-sm transition hover:border-white/25 hover:bg-white/[0.06]"
    >
      <span>{title}</span>
      <span className="text-[11px] font-medium uppercase tracking-wide text-white/40">
        ver secção
      </span>
    </Link>
  );
}

function RuleCard({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.015] p-5 shadow-[0_8px_40px_rgba(0,0,0,0.35)] md:mb-7 md:p-6"
    >
      <h2 className="mb-3 text-base font-semibold tracking-tight md:text-lg">{title}</h2>
      {children}
    </section>
  );
}

function CtaButton({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.10]"
    >
      {label}
    </a>
  );
}
