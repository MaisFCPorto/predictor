'use client';

import './globals.css';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
  // podes afinar estes valores se quiseres
  if (width >= 1900) return '300'; // écrans bem largos → 300x600
  if (width >= 1500) return '160'; // intermédio → 160x600
  return '120';                    // mais justo → 120x600
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
    // só mostra em >= 1280px (xl) para não esmagar layout em portáteis pequenos
    <div className="pointer-events-none fixed inset-y-0 left-0 right-0 z-[40] hidden items-center justify-between xl:flex">
      {/* LEFT */}
      <div className="pointer-events-auto pl-3">
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
      <div className="pointer-events-auto pr-3">
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
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-3 md:hidden">
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

/* ------------------------------------------------------------------
   ROOT LAYOUT
------------------------------------------------------------------- */

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

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

    const { data } = supabasePKCE.auth.onAuthStateChange(async (_event, session) => {
      if (ignore) return;

      const authUser = session?.user ?? null;
      if (authUser) {
        const friendlyName =
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

  const navLinks = [
    { href: '/jogos', label: 'Jogos' },
    { href: '/rankings', label: 'Rankings' },
    { href: '/premios', label: 'Prémios' },
    { href: '/regras', label: 'Regras' },
  ];

  const fullNavLinks = user?.isAdmin
    ? [{ href: '/admin', label: 'Backoffice' }, ...navLinks]
    : navLinks;

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
      <body className="min-h-screen bg-[#0a1e7a] bg-no-repeat bg-cover bg-fixed bg-center text-white">
        {/* BANNERS BETANO */}
        <BetanoSideRails />
        <BetanoMobileBanner />

        {/* NAVBAR */}
        <header className="nav-glass sticky top-0 z-50">
          <div className="relative mx-auto flex h-14 w-full max-w-6xl items-center px-4">
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
                  className={
                    'relative pb-0.5 transition-colors group ' +
                    (isActive(link.href)
                      ? 'text-white font-medium'
                      : 'text-white/75 hover:text-white')
                  }
                >
                  {link.label}
                  <span
                    className={
                      'pointer-events-none absolute left-0 right-0 -bottom-0.5 h-[2px] origin-center scale-x-0 rounded-full bg-white/70 transition-transform duration-200 ' +
                      (isActive(link.href) ? 'scale-x-100' : 'group-hover:scale-x-100')
                    }
                  />
                </Link>
              ))}

              {user && (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((open) => !open)}
                    className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:bg-white/10"
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

        {/* CONTEÚDO */}
        <main className="mx-auto w-full max-w-6xl px-4">{children}</main>

        {/* FOOTER */}
        <footer className="mt-10 border-t border-white/10">
          <div className="mt-3 flex flex-col items-center gap-2 text-[15px] text-white/75">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 hover:bg-white/10"
              onClick={() => setReportOpen((v) => !v)}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500/20 text-[10px] text-red-200">
                🐞
              </span>
              <span>Encontraste um erro? Reporta aqui</span>
            </button>

            {reportOpen && (
              <div className="mt-1 w-full max-w-xs rounded-2xl border border-white/15 bg-black/70 px-3 py-2 text-left text-[11px] leading-relaxed shadow-lg">
                <div className="font-medium text-white/90 mb-1">
                  Contactos para feedback/bugs
                </div>
                <div>
                  Email:{' '}
                  <a
                    href="mailto:geral@maisfcporto.com"
                    className="underline decoration-white/40 hover:decoration-white"
                  >
                    geral@maisfcporto.com
                  </a>
                </div>
                <div className="mt-1">
                  Instagram:{' '}
                  <a
                    href="https://www.instagram.com/maisfcporto"
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-white/40 hover:decoration-white"
                  >
                    @maisfcporto
                  </a>
                </div>
              </div>
            )}
          </div>
          <div className="mx-auto w-full max-w-6xl px-4 py-6 text-center text-xs leading-relaxed text-white/70">
            <div className="opacity-80">
              © {new Date().getFullYear()} +FCPorto Predictor. Todos os direitos
              reservados.
            </div>
            <div className="mt-1">
              As marcas, nomes e logótipos do +FCPorto e da Betano são
              propriedade dos respetivos titulares e estão protegidos por
              direitos de autor e/ou marcas registadas. Não é permitida a
              utilização para fins comerciais sem autorização.
            </div>
            <div className="mt-1">
              A utilização deste site implica a aceitação dos{' '}
              <Link
                href="/regras"
                className="underline underline-offset-2 hover:text-white/90"
              >
                Termos e Condições
              </Link>{' '}
              deste projeto.
            </div>
          </div>
        </footer>
        <Analytics />
        <SpeedInsights/> 
      </body>
    </html>
  );
}
