'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { supabasePKCE } from '@/utils/supabase/client';

type UserMini = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserMini | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  // carregar user do supabase
  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const { data } = await supabasePKCE.auth.getUser();
        const u = data.user;
        if (!ignore && u) {
          const friendly =
            (u.user_metadata?.name as string | undefined) ??
            u.email?.split('@')[0] ??
            'Jogador';

          setUser({
            id: u.id,
            name: friendly,
            avatar_url:
              (u.user_metadata?.avatar_url as string | null) ?? null,
          });
        }
      } finally {
        if (!ignore) setLoadingUser(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  // sempre que muda de página, fecha o menu mobile
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await supabasePKCE.auth.signOut();
    setUser(null);
    router.push('/auth');
  }

  const navItems = [
    { href: '/jogos', label: 'Jogos' },
    { href: '/rankings', label: 'Rankings' },
    { href: '/premios', label: 'Prémios' },
    { href: '/regras', label: 'Regras' },
  ];

  const isAuthPage = pathname?.startsWith('/auth');

  const initials =
    user?.name
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') ?? 'M';

  return (
    <html lang="pt">
      <body className="min-h-screen bg-[#0a1e7a] bg-no-repeat bg-cover bg-fixed bg-center text-white">
        {/* NAVBAR */}
        <header className="nav-glass sticky top-0 z-50">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4">
            {/* LOGO */}
            <Link
              href="/jogos"
              className="flex flex-1 items-center justify-center gap-2 sm:justify-start"
            >
              <Image
                src="/logos/predictor-03.svg"
                alt="+FCP Predictor"
                width={140}
                height={36}
                priority
                className="h-7 w-auto sm:h-8 md:h-9 transition-transform duration-300 ease-out hover:scale-[1.03]"
              />
            </Link>

            {/* NAV DESKTOP */}
            <nav className="hidden md:flex ml-auto items-center gap-6 text-sm">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'transition-colors',
                    pathname === item.href
                      ? 'text-white font-medium'
                      : 'text-white/75 hover:text-white',
                  )}
                >
                  {item.label}
                </Link>
              ))}

              {/* user loggado */}
              {!loadingUser && user && (
                <>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold">
                      {initials}
                    </div>
                    <span className="max-w-[120px] truncate">
                      {user.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/80 hover:bg-white/10"
                  >
                    <span>⏏</span>
                    <span>Terminar sessão</span>
                  </button>
                </>
              )}

              {/* sem user → Entrar */}
              {!loadingUser && !user && !isAuthPage && (
                <button
                  type="button"
                  onClick={() => router.push('/auth')}
                  className="rounded-full border border-white/10 bg-white/[0.08] px-4 py-1.5 text-xs font-medium hover:bg-white/[0.14]"
                >
                  Entrar
                </button>
              )}
            </nav>

            {/* BOTÃO HAMBURGUER (MOBILE) */}
            <button
              type="button"
              className="md:hidden ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur-sm"
              aria-label="Abrir menu"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span className="relative block h-4 w-4">
                <span
                  className={clsx(
                    'absolute left-0 top-0 h-[2px] w-full bg-white transition-transform duration-200',
                    mobileOpen ? 'translate-y-[6px] rotate-45' : '',
                  )}
                />
                <span
                  className={clsx(
                    'absolute left-0 top-1/2 h-[2px] w-full bg-white transition-opacity duration-150',
                    mobileOpen ? 'opacity-0' : 'opacity-100',
                  )}
                />
                <span
                  className={clsx(
                    'absolute left-0 bottom-0 h-[2px] w-full bg-white transition-transform duration-200',
                    mobileOpen ? '-translate-y-[6px] -rotate-45' : '',
                  )}
                />
              </span>
            </button>
          </div>

          {/* MENU MOBILE */}
          {mobileOpen && (
            <div className="md:hidden border-t border-white/10 bg-[#050826]/95 backdrop-blur-xl">
              <div className="mx-auto max-w-6xl px-4 py-4 space-y-4">
                {/* bloco user */}
                {!loadingUser && user && (
                  <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                      {initials}
                    </div>
                    <div className="flex flex-col text-xs">
                      <span className="text-white/60">Ligado como</span>
                      <span className="font-medium text-white truncate">
                        {user.name}
                      </span>
                    </div>
                  </div>
                )}

                {/* links */}
                <div className="flex flex-col gap-1 text-base">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        'rounded-xl px-3 py-2',
                        pathname === item.href
                          ? 'bg-white/10 font-medium'
                          : 'hover:bg-white/5',
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>

                {/* logout / entrar */}
                {!loadingUser && user && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 inline-flex items-center gap-2 rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-100"
                  >
                    <span>⏏</span>
                    <span>Terminar sessão</span>
                  </button>
                )}

                {!loadingUser && !user && !isAuthPage && (
                  <button
                    type="button"
                    onClick={() => router.push('/auth')}
                    className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15"
                  >
                    Entrar
                  </button>
                )}
              </div>
            </div>
          )}
        </header>

        {/* CONTEÚDO */}
        <main className="mx-auto w-full max-w-6xl px-4">{children}</main>

        {/* FOOTER */}
        <footer className="mt-10 border-t border-white/10">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs leading-relaxed text-white/70 text-center">
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
