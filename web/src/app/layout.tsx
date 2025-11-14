'use client';

import './globals.css';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabasePKCE } from '@/utils/supabase/client';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  /* ---------------------------------------------
     OBTÉM USER ATUAL (client-side)
  --------------------------------------------- */
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabasePKCE.auth.getUser();
      setUser(data?.user ?? null);
    }
    loadUser();

    // listener para login/logout
    const { data: listener } = supabasePKCE.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  /* ---------------------------------------------
     LOGOUT
  --------------------------------------------- */
  async function handleLogout() {
    try {
      await supabasePKCE.auth.signOut();
    } catch {}
    finally {
      setMobileOpen(false);
      router.push('/auth');
    }
  }

  const year = new Date().getFullYear();

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

              {/* BOTÃO LOGOUT - APENAS SE USER ESTIVER LOGADO */}
              {user && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors"
                >
                  Terminar sessão
                </button>
              )}
            </nav>

            {/* BOTÃO HAMBURGER (MOBILE) */}
            <button
              type="button"
              className="md:hidden inline-flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Abrir menu"
            >
              <span className="block h-0.5 w-5 rounded-full bg-white"></span>
              <span className="block h-0.5 w-5 rounded-full bg-white"></span>
              <span className="block h-0.5 w-5 rounded-full bg-white"></span>
            </button>

          </div>

          {/* MENU MOBILE */}
          {mobileOpen && (
            <div className="md:hidden border-t border-white/10 bg-[#020838]/95 backdrop-blur">
              <nav className="mx-auto flex w-full max-w-6xl flex-col px-4 py-3 text-sm">

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
                    className="mt-2 py-2 text-left text-xs font-medium text-red-300 hover:text-red-200"
                  >
                    Terminar sessão
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
              As marcas, nomes e logótipos do +FCPorto e da Betano são propriedade dos respetivos titulares e estão protegidos por direitos de autor e/ou marcas registadas.
            </div>

            <div className="mt-1">
              A utilização deste site implica a aceitação dos{' '}
              <Link href="/regras" className="underline underline-offset-2 hover:text-white/90">
                Termos e Condições
              </Link>.
            </div>

          </div>
        </footer>

      </body>
    </html>
  );
}
