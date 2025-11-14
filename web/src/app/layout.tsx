'use client';

import './globals.css';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabasePKCE } from '@/utils/supabase/client';

type UserInfo = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const loggedIn = !!user;

  // Buscar user autenticado
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabasePKCE.auth.getUser();
        if (!mounted) return;

        if (data?.user) {
          const u = data.user;
          const friendly =
            (u.user_metadata as any)?.name ||
            u.email?.split('@')[0] ||
            'Jogador';

          setUser({
            id: u.id,
            name: friendly,
            avatar_url: (u.user_metadata as any)?.avatar_url ?? null,
          });
        } else {
          setUser(null);
        }
      } catch {
        if (mounted) setUser(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Fecha menus ao mudar de rota
  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    try {
      await supabasePKCE.auth.signOut();
    } finally {
      setUser(null);
      router.push('/auth');
    }
  }

  const navLinks = [
    { href: '/rankings', label: 'Rankings' },
    { href: '/premios', label: 'Prémios' },
    { href: '/regras', label: 'Regras' },
  ];

  return (
    <html lang="pt">
      <body className="min-h-screen bg-[#0a1e7a] bg-no-repeat bg-cover bg-fixed bg-center text-white">
        <header className="nav-glass sticky top-0 z-50">
          <div className="relative mx-auto flex h-14 w-full max-w-6xl items-center px-4">
            {/* LOGO — centrado em mobile, à esquerda em desktop */}
            <Link
              href={loggedIn ? '/jogos' : '/auth'}
              className="mx-auto flex items-center gap-2 md:mx-0 md:mr-6"
            >
              <Image
                src="/logos/predictor-03.svg"
                alt="+FCP Predictor"
                width={170}
                height={42}
                priority
                className="h-7 w-auto sm:h-8 md:h-9"
              />
            </Link>

            {/* NAV + User dropdown (desktop) */}
            <div className="ml-auto hidden items-center gap-6 md:flex">
              <nav className="flex gap-6 text-sm">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="transition-colors hover:text-white/90"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              {loggedIn && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1.5 text-xs hover:bg-white/10"
                  >
                    {/* Avatar */}
                    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-white/10 text-[11px] font-semibold">
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.avatar_url}
                          alt={user.name ?? 'avatar'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>
                          {user.name
                            ?.split(' ')
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((p) => p[0]?.toUpperCase())
                            .join('') || 'JP'}
                        </span>
                      )}
                    </div>

                    {/* Nome + chevron */}
                    <span className="max-w-[9rem] truncate text-xs font-medium">
                      {user.name ?? 'Jogador'}
                    </span>
                    <svg
                      className={`h-3 w-3 transition-transform ${
                        profileOpen ? 'rotate-180' : ''
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {/* Dropdown perfil (desktop) */}
                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-40 rounded-2xl border border-white/10 bg-[#050b2b]/95 p-1 text-xs shadow-xl backdrop-blur">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-red-200 hover:bg-red-500/10"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <path d="M16 17l5-5-5-5" />
                          <path d="M21 12H9" />
                        </svg>
                        <span>Terminar sessão</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* HAMBURGER (mobile) */}
            <button
              type="button"
              className="absolute right-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/40 md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Abrir menu"
            >
              <span className="sr-only">Menu</span>
              <span className="relative flex h-4 w-4 items-center justify-center">
                {/* 3 barras que animam para X */}
                <span
                  className={`absolute h-[2px] w-full rounded bg-white transition-transform duration-200 ${
                    menuOpen
                      ? 'translate-y-0 rotate-45'
                      : '-translate-y-1'
                  }`}
                />
                <span
                  className={`absolute h-[2px] w-full rounded bg-white transition-opacity duration-150 ${
                    menuOpen ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                <span
                  className={`absolute h-[2px] w-full rounded bg-white transition-transform duration-200 ${
                    menuOpen
                      ? 'translate-y-0 -rotate-45'
                      : 'translate-y-1'
                  }`}
                />
              </span>
            </button>
          </div>

          {/* DROPDOWN MOBILE com animação */}
          {menuOpen && (
            <div className="origin-top border-t border-white/10 bg-[#050b2b]/95 pb-3 pt-2 text-sm shadow-lg backdrop-blur-md animate-[fadeDown_0.18s_ease-out] md:hidden">
              <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4">
                {loggedIn && (
                  <div className="mb-1 flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/10 text-[11px] font-semibold">
                      {user!.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user!.avatar_url!}
                          alt={user!.name ?? 'avatar'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>
                          {user!.name
                            ?.split(' ')
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((p) => p[0]?.toUpperCase())
                            .join('') || 'JP'}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs opacity-70">
                        Ligado como
                      </span>
                      <span className="text-sm font-medium">
                        {user!.name ?? 'Jogador'}
                      </span>
                    </div>
                  </div>
                )}

                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-xl px-3 py-2 hover:bg-white/10"
                  >
                    {link.label}
                  </Link>
                ))}

                {loggedIn ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-left text-red-200 hover:bg-red-500/10"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="M16 17l5-5-5-5" />
                      <path d="M21 12H9" />
                    </svg>
                    <span>Terminar sessão</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/auth')}
                    className="mt-2 rounded-xl px-3 py-2 text-left hover:bg-white/10"
                  >
                    Entrar / Registar
                  </button>
                )}
              </div>
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-6xl px-4">{children}</main>

        <footer className="mt-10 border-t border-white/10">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 text-center text-xs leading-relaxed text-white/70">
            <div className="opacity-80">
              © {new Date().getFullYear()} +FCPorto Predictor. Todos os direitos reservados.
            </div>
            <div className="mt-1">
              As marcas, nomes e logótipos do +FCPorto e da Betano são propriedade dos respetivos
              titulares e estão protegidos por direitos de autor e/ou marcas registadas. Não é
              permitida a utilização para fins comerciais sem autorização.
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
