'use client';

import './globals.css';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabasePKCE } from '@/utils/supabase/client';

type UserInfo = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

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

          setUser({
            id: user.id,
            name: friendlyName,
            avatar_url:
              (user.user_metadata?.avatar_url as string | undefined) ?? null,
          });
        } else {
          setUser(null);
        }
      } finally {
        if (!ignore) setLoadingUser(false);
      }
    })();

    return () => {
      ignore = true;
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

  return (
    <html lang="pt">
      <body className="min-h-screen bg-[#0a1e7a] bg-no-repeat bg-cover bg-fixed bg-center text-white">
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
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    'relative pb-0.5 transition-colors ' +
                    (isActive(link.href)
                      ? 'text-white font-medium'
                      : 'text-white/75 hover:text-white')
                  }
                >
                  {link.label}
                  {/* sublinhado suave */}
                  <span
                    className={
                      'absolute left-0 right-0 -bottom-0.5 h-[2px] origin-center scale-x-0 rounded-full bg-white/70 transition-transform duration-200 ' +
                      (isActive(link.href) ? 'scale-x-100' : 'group-hover:scale-x-100')
                    }
                  />
                </Link>
              ))}

              {/* chip com user */}
              {user && (
                <>
                  <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">
                      {initials}
                    </div>
                    <span className="max-w-[120px] truncate">{user.name}</span>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs text-rose-100 shadow-[0_0_0_1px_rgba(248,113,113,0.25)] transition hover:bg-white/10"
                  >
                    <span className="text-[13px]">↪</span>
                    <span>Terminar sessão</span>
                  </button>
                </>
              )}

              {!user && !loadingUser && (
                <button
                  onClick={() => router.push('/auth')}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.12)] hover:bg-white/15"
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
              {/* cartão user */}
              <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/80 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                <div className="text-xs text-white/60">
                  {user ? 'Ligado como' : 'Não autenticado'}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold">
                    {user ? initials : '?'}
                  </div>
                  <div className="truncate text-sm font-medium">
                    {user ? user.name : 'Entra para começar a jogar'}
                  </div>
                </div>
              </div>

              {/* links */}
              <div className="space-y-1 text-base">
                {navLinks.map((link) => (
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
                    <span className="text-lg">↪</span>
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
      </body>
    </html>
  );
}
