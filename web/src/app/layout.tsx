'use client';

import './globals.css';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { supabasePKCE } from '@/utils/supabase/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from "@vercel/speed-insights/next"
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();

type UserInfo = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  isAdmin: boolean;
};

/* ------------------------------------------------------------------
   BETANO CREATIVES (IFRAME SRC)
------------------------------------------------------------------- */

// 120x600 – mais estreito
const BETANO_DESKTOP_IFRAME_120 =
  'https://gml-grp.com/I.ashx?btag=a_15985b_4104c_&affid=5177&siteid=15985&adid=4104&c=';

// 160x600 – o que já tinhas
const BETANO_DESKTOP_IFRAME_160 =
  'https://gml-grp.com/I.ashx?btag=a_15985b_4105c_&affid=5177&siteid=15985&adid=4105&c=';

// 300x600 – mais largo
const BETANO_DESKTOP_IFRAME_300 =
  'https://gml-grp.com/I.ashx?btag=a_15985b_4111c_&affid=5177&siteid=15985&adid=4111&c=';

// Mobile 320x100
const BETANO_MOBILE_IFRAME =
  'https://gml-grp.com/I.ashx?btag=a_15985b_4115c_&affid=5177&siteid=15985&adid=4115&c=';

/* ------------------------------------------------------------------
   SIDE RAILS (DESKTOP)
------------------------------------------------------------------- */

type RailVariant = '120' | '160' | '300';

const RAIL_CONFIG: Record<
  RailVariant,
  { src: string; width: number; height: number }
> = {
  '120': { src: BETANO_DESKTOP_IFRAME_120, width: 120, height: 600 },
  '160': { src: BETANO_DESKTOP_IFRAME_160, width: 160, height: 600 },
  '300': { src: BETANO_DESKTOP_IFRAME_300, width: 300, height: 600 },
};

function pickVariant(width: number): RailVariant {
  if (width >= 2200) return '300';
  if (width >= 1680) return '160';
  return '120';
}

function BetanoSideRails() {
  const [variant, setVariant] = useState<RailVariant>('160');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      setVariant(pickVariant(window.innerWidth));
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const cfg = RAIL_CONFIG[variant];

  return (
    // Mantém os anúncios fora da grelha principal e abaixo do cabeçalho.
    <div className="pointer-events-none fixed left-0 right-0 top-24 z-[40] hidden justify-between min-[1360px]:flex">
      {/* LEFT */}
      <div className="pointer-events-auto pl-2">
        <div className="overflow-hidden rounded-xl bg-black/40 shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
          <iframe
            src={cfg.src}
            width={cfg.width}
            height={cfg.height}
            style={{
              border: '0px',
              padding: 0,
              margin: 0,
              display: 'block',
            }}
          />
        </div>
      </div>

      {/* RIGHT */}
      <div className="pointer-events-auto pr-2">
        <div className="overflow-hidden rounded-xl bg-black/40 shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
          <iframe
            src={cfg.src}
            width={cfg.width}
            height={cfg.height}
            style={{
              border: '0px',
              padding: 0,
              margin: 0,
              display: 'block',
            }}
          />
        </div>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------
   MOBILE BOTTOM BANNER
------------------------------------------------------------------- */

function BetanoMobileBanner() {
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-[60] flex justify-center px-3 pb-3 md:hidden">
      <div className="relative w-full max-w-xs overflow-hidden rounded-2xl bg-black/45 shadow-[0_18px_40px_rgba(0,0,0,0.7)] backdrop-blur-md">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-[11px] text-white/80 shadow hover:bg-black/70"
          aria-label="Fechar banner"
        >
          ✕
        </button>

        <iframe
          src={BETANO_MOBILE_IFRAME}
          width="320"
          height="100"
          style={{
            border: '0px',
            padding: 0,
            margin: 0,
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}

function LandingPreviewHeader() {
  return (
    <header className="site-header sticky top-0 z-50">
      <div className="mx-auto flex h-16 w-[calc(100%_-_2rem)] max-w-[1120px] items-center gap-4">
        <Link href="/landing-preview" className="flex items-center">
          <Image
            src="/logos/predictor-03.svg"
            alt="+FCP Predictor"
            width={160}
            height={40}
            priority
            className="h-7 w-auto sm:h-8"
          />
        </Link>

        <nav className="ml-auto hidden items-center gap-6 text-sm md:flex">
          <a href="#como-funciona" className="nav-link">Como funciona</a>
          <a href="#premios" className="nav-link">Prémios</a>
          <a href="#ranking" className="nav-link">Ranking</a>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-4">
          <Link
            href="/auth"
            className="hidden rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-bold text-white/75 transition hover:bg-white/[0.08] sm:inline-flex"
          >
            Entrar
          </Link>
          <Link
            href="/auth"
            className="inline-flex rounded-xl bg-white px-3.5 py-2 text-xs font-extrabold text-[#06102b] transition hover:bg-cyan-50"
          >
            Criar conta
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------
   ROOT LAYOUT
------------------------------------------------------------------- */

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLandingPreview = pathname === '/landing-preview';

  const [user, setUser] = useState<UserInfo | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const {
          data: { user },
        } = await supabasePKCE.auth.getUser();

        if (ignore) return;

        if (user) {
          const friendlyName =
            (user.user_metadata?.visible_name as string | undefined) ??
            (user.user_metadata?.name as string | undefined) ??
            user.email?.split('@')[0] ??
            'Jogador';

          const base = API_BASE ? API_BASE.replace(/\/+$/, '') : '';
          const url = base
            ? `${base}/api/users/${encodeURIComponent(user.id)}/role`
            : `/api/users/${encodeURIComponent(user.id)}/role`;

          let roleFromApi: string | null = null;
          try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
              const json = await res.json().catch(() => ({} as any));
              roleFromApi = typeof json.role === 'string' ? json.role : null;
            }
          } catch {
          }

          const metaIsAdmin = (user.user_metadata as any)?.role === 'admin';
          const isAdmin = metaIsAdmin || roleFromApi === 'admin';

          setUser({
            id: user.id,
            name: friendlyName,
            avatar_url:
              (user.user_metadata?.avatar_url as string | undefined) ?? null,
            isAdmin,
          });
        } else {
          setUser(null);
        }
      } finally {
        if (!ignore) setLoadingUser(false);
      }
    })();

    const { data } = supabasePKCE.auth.onAuthStateChange(async (_event: string, session: { user: any } | null) => {
      if (ignore) return;

      const authUser = session?.user ?? null;
      if (authUser) {
        const friendlyName =
          (authUser.user_metadata?.visible_name as string | undefined) ??
          (authUser.user_metadata?.name as string | undefined) ??
          authUser.email?.split('@')[0] ??
          'Jogador';

        const base = API_BASE ? API_BASE.replace(/\/+$/, '') : '';
        const url = base
          ? `${base}/api/users/${encodeURIComponent(authUser.id)}/role`
          : `/api/users/${encodeURIComponent(authUser.id)}/role`;

        let roleFromApi: string | null = null;
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json().catch(() => ({} as any));
            roleFromApi = typeof json.role === 'string' ? json.role : null;
          }
        } catch {
        }

        const metaIsAdmin = (authUser.user_metadata as any)?.role === 'admin';
        const isAdmin = metaIsAdmin || roleFromApi === 'admin';

        setUser({
          id: authUser.id,
          name: friendlyName,
          avatar_url:
            (authUser.user_metadata?.avatar_url as string | undefined) ?? null,
          isAdmin,
        });
      } else {
        setUser(null);
      }

      setLoadingUser(false);
    });

    return () => {
      ignore = true;
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    try {
      await supabasePKCE.auth.signOut();
    } finally {
      setUser(null);
      setMobileOpen(false);
      router.push('/auth');
    }
  }

  const baseNavLinks = [
    { href: '/jogos', label: 'Jogos' },
    { href: '/ligas', label: 'Ligas' },
    { href: '/rankings', label: 'Rankings' },
    { href: '/premios', label: 'Prémios' },
    { href: '/regras', label: 'Regras' },
  ];

  // Links que só admin vê
  const navLinks = user?.isAdmin
    ? [
        { href: '/shop', label: 'Loja' },
        ...baseNavLinks
      ]
    : baseNavLinks;

  const fullNavLinks = user?.isAdmin
    ? [{ href: '/admin', label: 'Backoffice' }, ...navLinks]
    : navLinks;

  const mobilePrimaryLinks = baseNavLinks;

  const isActive = (href: string) =>
    pathname === href ||
    (href !== '/jogos' && pathname?.startsWith(href ?? ''));

  const initials =
    (user?.name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || 'M';

  useEffect(() => {
    if (!userMenuOpen) return;

    function handleClickOutside(ev: MouseEvent) {
      const target = ev.target as Node | null;
      if (!userMenuRef.current || !target) return;
      if (!userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  return (
    <html lang="pt">
      <body className={`app-body text-white${isLandingPreview ? ' landing-preview-body' : ''}`}>
        {/* BANNERS BETANO */}
        {!isLandingPreview && (
          <>
            <BetanoSideRails />
            <BetanoMobileBanner />
          </>
        )}

        {/* NAVBAR */}
        {isLandingPreview ? (
          <LandingPreviewHeader />
        ) : (
        <header className="site-header sticky top-0 z-50">
          <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center px-4">
            {/* LOGO – centrado em mobile, à esquerda em desktop */}
            <Link
              href="/jogos"
              className="group mx-auto flex items-center gap-2 transition-transform duration-200 md:mx-0 md:translate-x-0 hover:translate-y-[1px]"
            >
              <Image
                src="/logos/predictor-03.svg"
                alt="+FCP Predictor"
                width={160}
                height={40}
                priority
                className="h-7 w-auto sm:h-8 transition-transform duration-200 group-hover:scale-[1.05]"
              />
            </Link>

            {/* NAV DESKTOP (direita) */}
            <nav className="ml-auto hidden items-center gap-6 text-sm md:flex">
              {fullNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="nav-link"
                  data-active={isActive(link.href)}
                >
                  {link.label}
                </Link>
              ))}

              {user && (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((open) => !open)}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/80 hover:border-white/20 hover:bg-white/[0.07]"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">
                      {initials}
                    </div>
                    <span className="max-w-[120px] truncate text-left">{user.name}</span>
                    <span className="text-[10px] opacity-70">▾</span>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-2xl border border-white/10 bg-black/95 text-sm shadow-xl">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-white/90 hover:bg-white/10"
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push('/profile');
                        }}
                      >
                        Perfil
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-white/90 hover:bg-white/10"
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleLogout();
                        }}
                      >
                        Terminar sessão
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!user && !loadingUser && (
                <button
                  onClick={() => router.push('/auth')}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.12)] hover:bg:white/15 hover:bg-white/15"
                >
                  Entrar
                </button>
              )}
            </nav>

            {/* BOTÃO MOBILE: hamburger → X */}
            <button
              type="button"
              className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white/90 shadow-md backdrop-blur-sm transition-transform duration-150 hover:scale-105 md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            >
              <span className="relative block h-4 w-4">
                <span
                  className={
                    'absolute left-0 right-0 h-[2px] rounded-full bg-current transition-transform duration-200 ' +
                    (mobileOpen
                      ? 'top-1/2 -translate-y-1/2 rotate-45'
                      : 'top-[2px]')
                  }
                />
                <span
                  className={
                    'absolute left-0 right-0 h-[2px] rounded-full bg-current transition-all duration-200 ' +
                    (mobileOpen
                      ? 'top-1/2 -translate-y-1/2 opacity-0'
                      : 'top-1/2 -translate-y-1/2 opacity-100')
                  }
                />
                <span
                  className={
                    'absolute left-0 right-0 h-[2px] rounded-full bg-current transition-transform duration-200 ' +
                    (mobileOpen
                      ? 'top-1/2 -translate-y-1/2 -rotate-45'
                      : 'bottom-[2px]')
                  }
                />
              </span>
            </button>
          </div>

          {/* SHEET MOBILE */}
          <div
            className={
              'md:hidden overflow-hidden transition-[max-height,opacity] duration-200 ' +
              (mobileOpen ? 'max-height-anim-open opacity-100 max-h-[420px]' : 'max-h-0 opacity-0')
            }
          >
            <div className="mx-auto w-full max-w-6xl px-4 pb-4 pt-2 space-y-4">
              <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/80 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                <div className="text-xs text-white/60">
                  {user ? 'Ligado como' : 'Não autenticado'}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg:white/10 bg-white/10 text-[11px] font-semibold">
                    {user ? initials : '?'}
                  </div>
                  <div className="truncate text-sm font-medium">
                    {user ? user.name : 'Entra para começar a jogar'}
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-base">
                {fullNavLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={
                      'block rounded-xl px-4 py-2 transition-colors ' +
                      (isActive(link.href)
                        ? 'bg-white/10 font-medium'
                        : 'hover:bg-white/5')
                    }
                  >
                    {link.label}
                  </Link>
                ))}

                {user ? (
                  <button
                    onClick={handleLogout}
                    className="mt-2 flex w-full items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-2 text-left text-sm text-rose-100 transition hover:bg-rose-500/15"
                  >
                    <span>Terminar sessão</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      router.push('/auth');
                    }}
                    className="mt-2 flex w-full items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-left text-sm transition hover:bg-white/15"
                  >
                    Entrar / Registar
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>
        )}

        {/* CONTEÚDO */}
        <main className={isLandingPreview ? 'w-full' : 'app-container'}>
          {children}
        </main>

        {/* FOOTER */}
        <footer className="site-footer">
          <div className="app-container flex flex-col gap-4 py-7 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold text-white/90">+FCPorto Predictor</div>
              <div className="mt-1 text-xs">Palpites, ranking e prémios para a comunidade portista.</div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
              <Link href="/jogos" className="hover:text-white">Jogos</Link>
              <Link href="/rankings" className="hover:text-white">Rankings</Link>
              <Link href="/premios" className="hover:text-white">Prémios</Link>
              <Link href="/regras" className="hover:text-white">Regras</Link>
              <button
                type="button"
                className="hover:text-white"
                onClick={() => setReportOpen((v) => !v)}
              >
                Reportar erro
              </button>
            </div>
          </div>

          {reportOpen && (
            <div className="app-container pb-6">
              <div className="surface max-w-md px-4 py-3 text-xs leading-relaxed text-white/70">
                Envia o detalhe para{' '}
                <a href="mailto:geral@maisfcporto.com" className="text-white underline decoration-white/30">
                  geral@maisfcporto.com
                </a>{' '}
                ou por mensagem para{' '}
                <a
                  href="https://www.instagram.com/maisfcporto"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white underline decoration-white/30"
                >
                  @maisfcporto
                </a>.
              </div>
            </div>
          )}

          <div className="border-t border-white/[0.06]">
            <div className="app-container py-4 text-[11px] leading-relaxed text-white/40">
              © {new Date().getFullYear()} +FCPorto Predictor. As marcas, nomes e logótipos do +FCPorto e da Betano são propriedade dos respetivos titulares e estão protegidos por direitos de autor e/ou marcas registadas. Não é permitida a utilização para fins comerciais sem autorização.
A utilização deste site implica a aceitação dos {' '}
                <a
                  href="/regras"           
                  rel="noreferrer"
                  className="text-white underline decoration-white/30"
                >
                  Termos e Condições
                </a> deste projeto
            </div>
          </div>
        </footer>

        {!isLandingPreview && (
          <nav className="mobile-bottom-nav" aria-label="Navegação principal">
            {mobilePrimaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                data-active={isActive(link.href)}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
        <Analytics />
        <SpeedInsights/>
      </body>
    </html>
  );
}
