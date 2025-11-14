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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

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

          setUser({ id: u.id, name: friendly });
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

  // Fecha o menu mobile quando muda de rota
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const loggedIn = !!user;

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
                width={160}
                height={40}
                priority
                className="h-7 w-auto sm:h-8 md:h-9"
              />
            </Link>

            {/* NAV + Logout (desktop) */}
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
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10"
                >
                  Terminar sessão
                </button>
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
              <span className="flex h-4 w-4 flex-col justify-between">
                <span className="h-[2px] w-full rounded bg-white" />
                <span className="h-[2px] w-full rounded bg-white" />
                <span className="h-[2px] w-full rounded bg-white" />
              </span>
            </button>
          </div>

          {/* DROPDOWN MOBILE */}
          {menuOpen && (
            <div className="border-t border-white/10 bg-[#050b2b]/95 backdrop-blur-sm md:hidden">
              <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-sm">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-xl px-3 py-2 hover:bg-white/10"
                  >
                    {link.label}
                  </Link>
                ))}

                {loggedIn && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 rounded-xl px-3 py-2 text-left text-red-200 hover:bg-red-500/10"
                  >
                    Terminar sessão
                  </button>
                )}

                {!loggedIn && (
                  <button
                    type="button"
                    onClick={() => router.push('/auth')}
                    className="mt-1 rounded-xl px-3 py-2 text-left hover:bg-white/10"
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
