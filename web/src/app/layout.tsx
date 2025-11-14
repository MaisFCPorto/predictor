'use client';

import './globals.css';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabasePKCE } from '@/utils/supabase/client';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState<string>('Jogador');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const profileRef = useRef<HTMLDivElement | null>(null);

  /* ---------------------------------------------
     OBTÉM USER ATUAL (client-side)
  --------------------------------------------- */
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabasePKCE.auth.getUser();
      const u = data?.user ?? null;
      setUser(u);

      if (u) {
        const niceName =
          (u.user_metadata?.name as string | undefined) ||
          (u.email ? u.email.split('@')[0] : 'Jogador');

        setUserName(niceName);
        setAvatarUrl(
          (u.user_metadata?.avatar_url as string | undefined) ?? null,
        );
      } else {
        setUserName('Jogador');
        setAvatarUrl(null);
      }
    }

    loadUser();

    const { data: listener } = supabasePKCE.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  /* ---------------------------------------------
     CLICK OUTSIDE para fechar dropdown do perfil
  --------------------------------------------- */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!profileRef.current) return;
      if (!profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileOpen]);

  /* ---------------------------------------------
     LOGOUT
  --------------------------------------------- */
  async function handleLogout() {
    try {
      await supabasePKCE.auth.signOut();
    } catch {
      // ignora erros silenciosamente
    } finally {
      setMobileOpen(false);
      setProfileOpen(false);
      router.push('/auth');
    }
  }

  const year = new Date().getFullYear();

  function initials(name: string) {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('');
  }

  return (
    <html lang="pt">
      <body className="min-h-screen bg-[#0a1e7a] bg-no-repeat bg-cover bg-fixed bg-center text-white">

        {/* HEADER / NAVBAR */}
        <header className="nav-glass sticky top-0 z-50">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">

            {/* LOGO */}
            <Link href="/jogos" className="flex items-center gap-2">
              <Image
                src="/logos/predictor-03.svg"
                alt="+FCPorto Predictor"
                width={120}
                height={32}
                priority
                className="h-6 w-auto sm:h-7 md:h-8"
              />
            </Link>

            {/* NAV DESKTOP */}
            <nav className="hidden md:flex items-center gap-6 text-sm">

              <Link href="/rankings" className="hover:text-white/90 transition-colors">
                Rankings
              </Link>

              <Link href="/premios" className="hover:text-white/90 transition-colors">
                Prémios
              </Link>

              <Link href="/regras" className="hover:text-white/90 transition-colors">
                Regras
              </Link>

              {/* PERFIL + DROPDOWN (apenas se user logado) */}
              {user && (
                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setProfileOpen((o) => !o)}
                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors"
                  >
                    {/* Avatar */}
                    <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-white/20 text-[11px]">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt={userName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{initials(userName)}</span>
                      )}
                    </span>

                    {/* Nome */}
                    <span className="max-w-[110px] truncate">{userName}</span>

                    {/* Chevrons */}
                    <svg
                      className={`h-3 w-3 transition-transform ${
                        profileOpen ? 'rotate-180' : ''
                      }`}
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-white/10 bg-[#020838]/95 py-1 shadow-lg backdrop-blur">
                      <div className="px-3 py-2 text-[11px] text-white/60 border-b border-white/10">
                        Sessão iniciada como{' '}
                        <span className="font-semibold text-white/90">{userName}</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-300 hover:bg-white/10 hover:text-red-200"
                      >
                        {/* ícone logout */}
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path
                            d="M15 3h-6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M10 12h10m0 0-3-3m3 3-3 3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>Terminar sessão</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </nav>

            {/* BOTÃO HAMBURGER (MOBILE) */}
            <button
              type="button"
              className="md:hidden inline-flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              onClick={() => {
                setMobileOpen((o) => !o);
                setProfileOpen(false);
              }}
              aria-label="Abrir menu"
              aria-expanded={mobileOpen}
            >
              <span
                className={`block h-0.5 w-5 rounded-full bg-white transition-transform ${
                  mobileOpen ? 'translate-y-[5px] rotate-45' : ''
                }`}
              />
              <span
                className={`block h-0.5 w-5 rounded-full bg-white transition-opacity ${
                  mobileOpen ? 'opacity-0' : 'opacity-100'
                }`}
              />
              <span
                className={`block h-0.5 w-5 rounded-full bg-white transition-transform ${
                  mobileOpen ? '-translate-y-[5px] -rotate-45' : ''
                }`}
              />
            </button>
          </div>

          {/* MENU MOBILE */}
          {mobileOpen && (
            <div className="md:hidden border-t border-white/10 bg-[#020838]/95 backdrop-blur">
              <nav className="mx-auto flex w-full max-w-6xl flex-col px-4 py-3 text-sm space-y-1">

                {/* Bloco de user quando logado */}
                {user && (
                  <div className="mb-2 flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/20 text-xs">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl}
                          alt={userName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{initials(userName)}</span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold">
                        {userName}
                      </div>
                      <div className="text-[11px] text-white/60">
                        Sessão iniciada
                      </div>
                    </div>
                  </div>
                )}

                <Link
                  href="/rankings"
                  className="py-2 border-b border-white/10 hover:text-white/90 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Rankings
                </Link>

                <Link
                  href="/premios"
                  className="py-2 border-b border-white/10 hover:text-white/90 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Prémios
                </Link>

                <Link
                  href="/regras"
                  className="py-2 border-b border-white/10 hover:text-white/90 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Regras
                </Link>

                {/* LOGOUT NO MENU MOBILE */}
                {user && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-2 flex items-center gap-2 py-2 text-left text-xs font-medium text-red-300 hover:text-red-200"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path
                        d="M15 3h-6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10 12h10m0 0-3-3m3 3-3 3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>Terminar sessão</span>
                  </button>
                )}
              </nav>
            </div>
          )}
        </header>

        {/* MAIN CONTENT */}
        <main className="mx-auto w-full max-w-6xl px-4">{children}</main>

        {/* FOOTER */}
        <footer className="mt-10 border-t border-white/10">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs leading-relaxed text-white/70 text-center">
            <div className="opacity-80">
              © {year} +FCPorto Predictor. Todos os direitos reservados.
            </div>
            <div className="mt-1">
              As marcas, nomes e logótipos do +FCPorto e da Betano são propriedade dos respetivos titulares
              e estão protegidos por direitos de autor e/ou marcas registadas. Não é permitida a utilização
              para fins comerciais sem autorização.
            </div>
            <div className="mt-1">
              A utilização deste site implica a aceitação dos{' '}
              <Link href="/regras" className="underline underline-offset-2 hover:text-white/90">
                Termos e Condições
              </Link>
              .
            </div>
          </div>
        </footer>

      </body>
    </html>
  );
}
